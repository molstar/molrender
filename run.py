import subprocess
if __name__ == '__main__':
	out = subprocess.Popen(
			['node', 'src/render-main.js', 'getlen', 'examples/1crn.cif', '0'], 
			stdout=subprocess.PIPE, stderr=subprocess.STDOUT
		)
	stdout, stderr = out.communicate()
	print stdout