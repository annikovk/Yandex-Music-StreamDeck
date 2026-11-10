#!/usr/bin/perl
# Yandex Music DOM dumper for Stream Deck plugin diagnostics (macOS).
#
# Double-click in Finder to launch. Uses only /usr/bin/perl (pre-installed on
# every macOS) — no Python, no Node, no Homebrew, no installs.
#
# Connects to the Chrome DevTools Protocol exposed by Yandex Music on port
# 9339 (opened by the Stream Deck plugin when it launches the app), dumps the
# current DOM once per second to JSON files in ./dom-dumps/, and stops on
# Ctrl+C. Then the user zips the folder and sends it back.

use strict;
use warnings;
use IO::Socket::INET;
use MIME::Base64 qw(encode_base64);
use JSON::PP;
use POSIX qw(strftime);
use File::Basename qw(dirname);
use File::Path qw(make_path);
use File::Spec;
use Encode qw(encode);
use Time::HiRes qw(gettimeofday);

$| = 1; # autoflush stdout
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

# Resolve script dir even when invoked as a .command (cwd may be $HOME)
my $SCRIPT_DIR = File::Spec->rel2abs(dirname($0));
my $OUTPUT_DIR = "$SCRIPT_DIR/dom-dumps";
make_path($OUTPUT_DIR);

my $HOST = 'localhost';
my $PORT = 9339;

print "\n";
print "==========================================\n";
print " Yandex Music DOM dumper (macOS)\n";
print "==========================================\n\n";
print "Before continuing:\n";
print "  1. Make sure Yandex Music is running through the Stream Deck plugin\n";
print "     (the plugin launches the app with --remote-debugging-port=$PORT).\n";
print "  2. Navigate to the page where Stream Deck buttons do not work\n";
print "     (e.g. My Vibe / Моя Волна).\n";
print "  3. Once the dump is running, press the Stream Deck buttons that\n";
print "     should be working and try them inside the app too.\n";
print "  4. Stop with Ctrl+C, then zip the 'dom-dumps' folder and send it.\n\n";

# --- HTTP GET to /json on the CDP port -------------------------------------
# Uses /usr/bin/curl (pre-installed on macOS). Reimplementing HTTP in Perl
# was tempting but the CDP HTTP server doesn't always honour Connection: close
# and a manual sysread loop ends up hanging.
sub http_get {
    my ($host, $port, $path) = @_;
    my $url = "http://$host:$port$path";
    my $body = qx{/usr/bin/curl -sS --max-time 5 '$url' 2>/dev/null};
    return $body;
}

my $targets_json;
eval { $targets_json = http_get($HOST, $PORT, '/json'); };
if ($@ || !$targets_json) {
    print "ERROR: cannot reach Chrome DevTools Protocol on port $PORT.\n";
    print "Start Yandex Music via the Stream Deck plugin first, then re-run.\n\n";
    print "Press Enter to exit..."; <STDIN>; exit 1;
}

my $targets;
eval { $targets = decode_json($targets_json); };
if ($@ || ref($targets) ne 'ARRAY') {
    print "ERROR: unexpected response from CDP /json endpoint.\n";
    print "Body was:\n$targets_json\n";
    print "Press Enter to exit..."; <STDIN>; exit 1;
}

my $target;
for my $t (@$targets) {
    if (($t->{type} // '') eq 'page' && (($t->{url} // '') =~ /^music-application/)) {
        $target = $t; last;
    }
}

if (!$target) {
    print "ERROR: no 'music-application' page target found on port $PORT.\n";
    print "Targets discovered:\n";
    for my $t (@$targets) {
        printf "  [%s] %s -> %s\n", ($t->{type}//''), ($t->{title}//''), ($t->{url}//'');
    }
    print "\nPress Enter to exit..."; <STDIN>; exit 1;
}

print "Connecting to: ", ($target->{title} // ''), "\n";
print "URL:           ", ($target->{url}   // ''), "\n\n";

# --- WebSocket handshake ---------------------------------------------------
my $ws_url = $target->{webSocketDebuggerUrl} // '';
$ws_url =~ m{^ws://([^:/]+)(?::(\d+))?(/.*)?$}
    or die "unexpected webSocketDebuggerUrl: $ws_url\n";
my ($whost, $wport, $wpath) = ($1, $2 // 80, $3 // '/');

my $SOCK = IO::Socket::INET->new(
    PeerAddr => $whost, PeerPort => $wport, Proto => 'tcp', Timeout => 10,
) or die "cannot connect to $whost:$wport: $!\n";
$SOCK->autoflush(1);
binmode $SOCK;

my $rand_key = '';
$rand_key .= chr(int(rand 256)) for 1..16;
my $sec_key = encode_base64($rand_key, '');

my $req = "GET $wpath HTTP/1.1\r\n"
        . "Host: $whost:$wport\r\n"
        . "Upgrade: websocket\r\n"
        . "Connection: Upgrade\r\n"
        . "Sec-WebSocket-Key: $sec_key\r\n"
        . "Sec-WebSocket-Version: 13\r\n\r\n";
syswrite $SOCK, $req;

my $READ_BUF = '';
while ($READ_BUF !~ /\r\n\r\n/) {
    my $n = sysread($SOCK, my $buf, 4096);
    die "WebSocket handshake closed early\n" unless defined $n && $n > 0;
    $READ_BUF .= $buf;
}
my ($head, $leftover) = split /\r\n\r\n/, $READ_BUF, 2;
die "WebSocket handshake failed:\n$head\n" unless $head =~ /^HTTP\/1\.\d\s+101/;
$READ_BUF = $leftover // '';

# --- WebSocket frame I/O ---------------------------------------------------
sub ws_read_bytes {
    my $n = shift;
    while (length($READ_BUF) < $n) {
        my $got = sysread($SOCK, my $buf, 65536);
        die "WebSocket connection closed\n" unless defined $got && $got > 0;
        $READ_BUF .= $buf;
    }
    my $out = substr($READ_BUF, 0, $n);
    $READ_BUF = substr($READ_BUF, $n);
    return $out;
}

sub ws_send_text {
    my $text  = shift;
    my $bytes = encode('UTF-8', $text);
    my $len   = length($bytes);
    my @mask  = (int(rand 256), int(rand 256), int(rand 256), int(rand 256));
    my $masked = '';
    for (my $i = 0; $i < $len; $i++) {
        $masked .= chr(ord(substr($bytes, $i, 1)) ^ $mask[$i % 4]);
    }
    my $header = chr(0x81); # FIN | text opcode
    if ($len < 126)         { $header .= chr(0x80 | $len); }
    elsif ($len < 65536)    { $header .= chr(0x80 | 126) . pack('n',   $len); }
    else                    { $header .= chr(0x80 | 127) . pack('Q>',  $len); }
    syswrite $SOCK, $header . pack('C4', @mask) . $masked;
}

sub ws_recv_text {
    my $payload = '';
    while (1) {
        my ($b0, $b1) = unpack('CC', ws_read_bytes(2));
        my $fin    = $b0 & 0x80;
        my $opcode = $b0 & 0x0F;
        my $masked = $b1 & 0x80;
        my $len    = $b1 & 0x7F;
        if    ($len == 126) { ($len) = unpack('n',  ws_read_bytes(2)); }
        elsif ($len == 127) { ($len) = unpack('Q>', ws_read_bytes(8)); }
        my $mkey = $masked ? ws_read_bytes(4) : '';
        my $data = $len > 0 ? ws_read_bytes($len) : '';
        if ($masked) {
            my $u = '';
            for (my $i = 0; $i < length($data); $i++) {
                $u .= chr(ord(substr($data, $i, 1)) ^ ord(substr($mkey, $i % 4, 1)));
            }
            $data = $u;
        }
        if ($opcode == 0x8) { die "WebSocket closed by server\n"; }
        next if $opcode == 0x9 || $opcode == 0xA; # ping/pong
        $payload .= $data;
        last if $fin;
    }
    return $payload;
}

# --- JS payload to collect a DOM snapshot ----------------------------------
my $JS = <<'JS_END';
(function(){
    try {
        function rect(el){var r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),visible:r.width>0&&r.height>0};}
        function cls(el){return (el.className&&el.className.toString)?el.className.toString().slice(0,400):'';}
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            url: location.href,
            title: document.title,
            viewport: {w: window.innerWidth, h: window.innerHeight},
            testIds: Array.from(document.querySelectorAll('[data-test-id]')).map(function(el){
                return {
                    tid: el.getAttribute('data-test-id'),
                    tag: el.tagName,
                    cls: cls(el),
                    text: (el.textContent||'').trim().slice(0,120),
                    rect: rect(el),
                    spriteHrefs: Array.from(el.querySelectorAll('use')).map(function(u){return u.getAttribute('xlink:href')||u.getAttribute('href');}).filter(Boolean),
                    ariaPressed: el.getAttribute('aria-pressed'),
                    ariaLabel: el.getAttribute('aria-label'),
                    disabled: el.hasAttribute('disabled')
                };
            }),
            playerBarCandidates: Array.from(document.querySelectorAll('[class*="PlayerBar"], [class*="playerBar"], [class*="player-bar"], [class*="Player_"], [class*="Vibe"]')).slice(0,10).map(function(el){
                return { tag: el.tagName, cls: cls(el), rect: rect(el) };
            }),
            html: document.documentElement.outerHTML
        });
    } catch(err) {
        return JSON.stringify({ error: err.message, stack: err.stack });
    }
})()
JS_END

# --- Dump loop --------------------------------------------------------------
print "Dump loop is running. Press Ctrl+C to stop.\n\n";

my $counter = 0;
$SIG{INT} = sub {
    print "\n\nStopped. $counter snapshots saved to:\n  $OUTPUT_DIR\n\n";
    print "Please zip the 'dom-dumps' folder and send the archive back.\n\n";
    print "Press Enter to close this window..."; <STDIN>;
    exit 0;
};

my $msg_id = 0;
while (1) {
    eval {
        $msg_id++;
        my $msg = encode_json({
            id     => $msg_id,
            method => 'Runtime.evaluate',
            params => { expression => $JS, returnByValue => JSON::PP::true },
        });
        ws_send_text($msg);

        my $payload;
        while (1) {
            my $resp_text = ws_recv_text();
            my $r;
            eval { $r = decode_json($resp_text); };
            last if $@;
            if (defined $r->{id} && $r->{id} == $msg_id) {
                $payload = $r->{result}{result}{value} // $resp_text;
                last;
            }
        }

        my ($sec, $usec) = gettimeofday();
        my $ts   = strftime('%Y%m%d-%H%M%S', localtime($sec)) . sprintf('-%03d', int($usec / 1000));
        my $file = "$OUTPUT_DIR/dump-$ts.json";
        open(my $fh, '>:raw', $file) or die "cannot write $file: $!\n";
        print $fh encode('UTF-8', $payload);
        close $fh;

        $counter++;
        my $kb = int(length($payload) / 1024);
        printf "[%4d] dump-%s.json  (%d KB)\n", $counter, $ts, $kb;
        if ($counter > 0 && $counter % 60 == 0) {
            print "  -- $counter snapshots saved; press Ctrl+C when done --\n";
        }
    };
    if ($@) {
        my $err = $@; chomp $err;
        print "Snapshot failed: $err\n";
    }
    sleep 1;
}
