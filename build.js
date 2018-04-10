#! /usr/bin/env node

(async _ => {

	// imports
	const Preprocessor = require('preprocessor');
	const fs = require('fs');
	const tar = require('targz');
	const { compile } = require('nexe');
	const createPackage = require('osx-pkg');
	const createMsi = require('msi-packager');
	const pkg = require("./package.json");
	const { execSync } = require('child_process');
	const platform = process.platform;

	//helper functions
	function ensureDir(dir) { try { fs.mkdirSync(dir); } catch (e) {if ((e.errno != -17) && (e.errno != -4075)) console.log(e); } }
	function copy(src, dst) { try { fs.writeFileSync(dst, fs.readFileSync(src)); } catch (e) {if ((e.errno != -17) && (e.errno != -4075)) console.log(e); } }
	function createMacTarball() {
		console.log("Alternative Mac tar.gz being created since package capability is not available.")
		//make for mac
		tar.compress({
			src: "bin/mac/",
			dest: 'bin/xgraph_mac.tar.gz'
		}, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("Mac: Done!");
			}
		});
	}


	// real code in here
	try {
			
		

		ensureDir('bin');

		ensureDir('temp');

		ensureDir('bin/linux');
		ensureDir('bin/linux/bin');

		ensureDir('bin/mac');
		ensureDir('bin/mac/bin');

		ensureDir('bin/windows');
		ensureDir('bin/windows/bin');

		// take src/xgraph and shape it for nexe by cutting off the hashbang declaration
		// save the result to temp/xgraph
		let xgraphFile = fs.readFileSync('src/xgraph.js');
		xgraphFile = xgraphFile.toString();
		xgraphFile = xgraphFile.split('// -:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-')[1]
		fs.writeFileSync('temp/xgraph.js', xgraphFile);

		//compile temp/xgraph
		await compile({
			input: 'src/temp/xgraph.js',
			output: 'bin/linux/bin/xgraph',
			target: 'linux-x64-8.4.0',
			bundle: true,
			fakeArgv: false
		});

		fs.writeFileSync('src/gen/xgraph-windows.js', xgraphFile);
		// doImports('src/gen/xgraph-windows.js');
		// fs.writeFileSync('src/gen/xgraph-windows.js', new Preprocessor(fs.readFileSync('src/gen/xgraph-windows.js'), '.').process({ COMPILED: true }));
		
		await compile({
			input: 'src/gen/xgraph-windows.js',
			output: 'bin/windows/bin/xgraph.exe',
			target: 'windows-x64-8.4.0',
			bundle: true,
			fakeArgv: false
		});

		fs.writeFileSync('src/gen/xgraph-mac.js', xgraphFile);
		// doImports('src/gen/xgraph-mac.js');
		// fs.writeFileSync('src/gen/xgraph-mac.js', new Preprocessor(fs.readFileSync('src/gen/xgraph-mac.js'), '.').process({ MAC: true }));
		
		await compile({
			input: 'src/gen/xgraph-mac.js',
			output: 'bin/mac/bin/xgraph',
			target: 'mac-x64-8.4.0',
			bundle: true,
			fakeArgv: false
		});


		//move all required files to lib of system bin.


		// copy everything into bin/lib
		ensureDir('bin/lib')
		ensureDir('bin/lib/Nexus');

		fs.writeFileSync('bin/lib/Nexus/Nexus.js', new Preprocessor(fs.readFileSync('src/Nexus.js'), '.').process({ BUILT: true }));
		
		//copy bin/lib into bin/linux/lib
		ensureDir('bin/linux');
		ensureDir('bin/linux/lib');
		ensureDir('bin/linux/lib/Nexus');

		copy('bin/lib/Nexus/Nexus.js', 'bin/linux/lib/Nexus/Nexus.js');

		//copy bin/lib into bin/windows/lib
		ensureDir('bin/windows/bin')
		ensureDir('bin/windows/bin/lib');
		ensureDir('bin/windows/bin/lib/Nexus');

		copy('bin/lib/Nexus/Nexus.js', 'bin/windows/bin/lib/Nexus/Nexus.js');

		//copy bin/lib into bin/windows/lib
		ensureDir('bin/mac')
		ensureDir('bin/mac/lib');
		ensureDir('bin/mac/lib/Nexus');

		copy('bin/lib/Nexus/Nexus.js', 'bin/mac/lib/Nexus/Nexus.js');


		//make the tar.gz ... msi ... mac dmg/pkg
		//make for linux 
		tar.compress({
			src: "bin/linux/",
			dest: 'bin/xgraph_linux.tar.gz'
		}, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("Linux: Done!");
			}
		});

		var canCreatePackage = false;
		if (/^linux/.test(platform)) {
			let xar = (execSync('which xar').toString());
			if (xar != '') {
				let bomUtils = (execSync('which mkbom').toString());
				if (bomUtils != '') {
					canCreatePackage = true;
				} else {
					console.log("Missing xar: please install using");
					console.log("  'wget https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/xar/xar-1.5.2.tar.gz && tar -zxvf ./xar-1.5.2.tar.gz && cd ./xar-1.5.2 && ./configure && make && sudo make install'");
				}
			} else {
				console.log("Missing bomutils: please install using");
				console.log("  'git clone https://github.com/hogliux/bomutils && cd bomutils && make && sudo make install'")
			}
		} 

		if (canCreatePackage) {
			console.log("Building mac pkg installer.")
			let buildResults = (execSync('./build_mac_pkg.sh').toString());
			console.log(buildResults);
			console.log("Mac: Done!");
		} else {
			createMacTarball();
		}

		//make for windows
		var options = {
			source: 'bin/windows',
			output: 'bin/xgraph.msi',
			name: 'xGraph',
			upgradeCode: '67dd6b8a-fedf-4aa3-925a-d0dc4f620d8f',
			version: pkg.version,
			manufacturer: 'Introspective Systems, LLC.',
			iconPath: 'IS.png',
			executable: 'bin/windows/bin/xgraph.exe',
			arch: 'x64',
		};

		console.log("Ignore the following DeprecationWarning from msi-packager for asynchronous function without callback.");
		await new Promise(resolve => {
			createMsi(options, function (err) {
				if (/^win/.test(platform)) {
					console.log("MSI creation can only be done on mac or linux.");
					console.log('Windows: FAILED!');
				} else {
					if (err) throw err
					console.log('Windows: Done!');
				}
				resolve();
			});
		});


	}catch (e) {
		console.log('build failed');
		console.log(e);

		try {

		} catch(e) {}

		process.exit(1);
	}

})();
