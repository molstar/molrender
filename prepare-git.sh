#!/bin/bash
rm src/*.js
git add .
git commit -m "$1"
git push
