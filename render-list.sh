#!/bin/bash
input="./pdb-list.txt"
while IFS= read -r line
do
	node src/render-main.js all examples/$line.cif images
done < "$input"
