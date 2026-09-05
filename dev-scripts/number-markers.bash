#!/usr/bin/env bash
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

# [[ $# -eq 1 ]] || die "usage: $0 <file>"

# FILEPATH="$1"
# FMT="${INCREMENT_FORMAT:-}"

[[ -n "$FMT" ]]      || die "INCREMENT_FORMAT не задан"
[[ -f "$FILEPATH" ]] || die "не файл: $FILEPATH"
[[ -r "$FILEPATH" ]] || die "нет прав на чтение: $FILEPATH"
[[ -w "$FILEPATH" ]] || die "нет прав на запись: $FILEPATH"

printf -- "$FMT" 0 >/dev/null 2>&1 \
    || die "INCREMENT_FORMAT '$FMT' не принимает целое"

DIRPATH="$(dirname "$(realpath "$FILEPATH")")"
TMPFILE="$(mktemp "$DIRPATH/~increment_tmp_XXXXXX")"

trap 'rm -f "$TMPFILE"' EXIT

AWK_EXIT=0
awk -v fmt="$FMT" -v q="'" '
BEGIN {
    counter   = -1
    processed = 0
    had_error = 0
    start_re = "/\\*N=0\\*/" q "[^" q "]*" q "/\\*\\*/"
    pp_re    = "/\\*[+][+]N\\*/" q "[^" q "]*" q "/\\*\\*/"
}

{
    rest = $0
    out  = ""

    while (length(rest) > 0) {
        found_s = match(rest, start_re)
        spos = RSTART; slen = RLENGTH

        found_p = match(rest, pp_re)
        ppos = RSTART; plen = RLENGTH

        if (!found_s && !found_p) {
            out = out rest
            break
        }

        if (found_s && (!found_p || spos <= ppos)) {
            out     = out substr(rest, 1, spos - 1)
            counter = 0
            out     = out "/*N=0*/" q sprintf(fmt, counter) q "/**/"
            rest    = substr(rest, spos + slen)
            processed++
        } else {
            if (counter < 0) {
                print "error: /*++N*/ до /*N=0*/, строка " NR > "/dev/stderr"
                had_error = 1
                exit 1
            }
            counter++
            out  = out substr(rest, 1, ppos - 1)
            out  = out "/*++N*/" q sprintf(fmt, counter) q "/**/"
            rest = substr(rest, ppos + plen)
            processed++
        }
    }

    print out
}

END {
    if (!had_error && processed == 0) exit 2
}
' "$FILEPATH" > "$TMPFILE" || AWK_EXIT=$?

case $AWK_EXIT in
    0) ;;
    2) echo "маркеров не найдено, файл не изменён" >&2; exit 0 ;;
    *) die "обработка прервана, файл не изменён" ;;
esac

orig_size=$(wc -c < "$FILEPATH")
tmp_size=$(wc -c < "$TMPFILE")
if [[ $orig_size -gt 0 && $tmp_size -eq 0 ]]; then
    die "результат пустой при непустом оригинале, файл не изменён"
fi

mv "$TMPFILE" "$FILEPATH"
trap - EXIT
echo "готово" >&2