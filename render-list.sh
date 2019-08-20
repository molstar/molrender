#!/bin/bash
input="./pdb-list.txt"
while IFS= read -r line
do
	./render.sh ./examples/$line.cif ./images/
done < "$input"
