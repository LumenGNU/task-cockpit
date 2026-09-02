#!/usr/bin/env bash
width=${1:-1}
convert -size "${width}x1" xc:none png:- | base64
