#!/bin/bash
string=$(node src/get-cif.js $1 0)
arr=($(echo $string | tr " " "\n"))

x=0
while [ $x -lt ${arr[0]} ]
do
	node src/render-models.js $1 $x
	string=$(node src/get-cif.js $1 $x)
	arr1=($(echo $string | tr " " "\n"))
	asmNum=${arr1[1]}
	y=0
	while [ $y -lt $asmNum ]
	do
		node src/render-assemblies.js $1 $x $y
		y=$((y+1))
	done
	x=$((x+1))
done