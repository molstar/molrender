import sys
import requests
from pathlib import Path
r = requests.get('http://files.rcsb.org/download/' + sys.argv[1] + '.cif')
open('examples/' + sys.argv[1] + '.cif', 'wb').write(r.content)
with open("pdb-list.txt", "a") as myfile:
	myfile.write("\n" + sys.argv[1])

