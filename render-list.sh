#!/bin/bash
input="./pdb-list.txt"
while IFS= read -r line
do
	./renderID.sh "$line"
done < "$input"
