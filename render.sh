#!/bin/bash
input=$(node src/render-main.js getlen $1 0)
arr=($(echo $input | tr " " "\n"))

chainStr=$(node src/render-main.js getNames $1)
chains=($(echo $chainStr | tr " " "\n"))

for i in "${chains[@]}"
do
	node src/render-main.js chn $1 $2 $i --width 320 --height 320
	x=$((x+1))
done

x=0
while [ $x -lt ${arr[0]} ]
do
	node src/render-main mod $1 $2 $x --width 320 --height 320
	input=$(node src/render-main.js getlen $1 $x)
	arr=($(echo $input | tr " " "\n"))
	y=0
	while [ $y -lt ${arr[1]} ]
	do
		node src/render-main.js asm $1 $2 $x $y --width 320 --height 320
		node src/render-main.js comb $1 $2 $x $y --width 320 --height 320
		y=$((y+1))
	done
	x=$((x+1))
done
