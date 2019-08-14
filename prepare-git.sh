#!/bin/bash
if [ "$1" == "" ]; then
	echo -n "You did not type a commit message, are you sure about that? (y/N)"
	read -n 1 answer
	if [ "$answer" != "" ]; then
		echo ""
	fi
	if [ "$answer" == "Y" ] || [ "$answer" == "y" ]; then
		rm src/*.js
		rm images/*
		git add .
		git commit -m "$1"
		git push
	else
		echo "Aborting"
	fi
else
	rm src/*.js
	rm images/*
	git add .
	git commit -m "$1"
	git push
fi
