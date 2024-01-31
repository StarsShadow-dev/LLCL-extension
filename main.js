'use strict';

const vscode = require('vscode');
const child_process = require('child_process');
const fs = require("fs");
const { homedir } = require('os');

console.log("setting up the LLCL VS Code Extension");

let diagnosticList = [];

let diagnosticCollection = vscode.languages.createDiagnosticCollection('go');

function addDiagnostics(uri, array) {
	diagnosticList = [];
	
	for (let i = 0; i < array.length; i++) {
		const e = array[i];
		if (e[0] == 0) {
			diagnosticList.push(
				new vscode.Diagnostic(new vscode.Range(
					new vscode.Position(e[1] - 1, e[2]),
					new vscode.Position(e[1] - 1, e[3])),
					e[4]
				)
			);
		}
	}
	
	diagnosticCollection.set(uri, diagnosticList);
}

function getCompilerPath() {
	let compilerPath = "";
	
	const compilerPathConfiguration = vscode.workspace.getConfiguration().get('conf.llcl_vscode.compilerPath')
	if (compilerPathConfiguration.length > 0) {
		if (compilerPathConfiguration[0] == "~") {
			let newCompilerPath = compilerPathConfiguration.split("");
			newCompilerPath.shift();
			compilerPath = `${homedir}${newCompilerPath.join("")}`;
		} else {
			compilerPath = `${vscode.workspace.workspaceFolders[0].uri.path}${compilerPathConfiguration}`;
		}
	} else {
		compilerPath = `${homedir}/.LLCL/LLCL`;
	}
	
	return compilerPath;
}

vscode.languages.registerHoverProvider('llcl', {
	async provideHover(document, position, token) {
		// get the document text (it may not have been saved to the file system yet)
		const text = document.getText();
		
		// get the hover location
		const line = position.line + 1;
		const character = position.character;
		console.log("line", line, "character", character);
		
		// get the compilerPath
		const compilerPath = getCompilerPath();
		
		return new Promise((resolve, reject) => {
			let gotData = false;
			
			try {
				const args = ["query", "hover", document.uri.path, text.length + 1, line, character];
				console.log(compilerPath, args);
				const childProcess = child_process.spawn(compilerPath, args);
				
				childProcess.stdin.write(text + "\n");
				
				childProcess.on('error', (error) => {
					console.log(`error: ${error}`);
				});
				
				childProcess.stdout.on('data', (data) => {
					console.log("hover data", `${data}`, JSON.parse(`${data}`));
					
					gotData = true;
					try {
						const array = JSON.parse(`${data}`);
						
						addDiagnostics(document.uri, array);
						
						let contents = [];
						
						for (let i = 0; i < array.length; i++) {
							const e = array[i];
							if (e[0] == 2) {
								contents.push(new vscode.MarkdownString(e[3]));
							}
						}
						
						resolve({
							contents: contents
						});
					} catch (error) {
						console.log("error", error);
						resolve({
							contents: ["childProcess stdout error"]
						});
					}
				});
				
				childProcess.on('close', (code) => {
					console.log(`process exited with code ${code}`);
					if (!gotData) {
						if (code != 0) {
							diagnosticCollection.clear();
							resolve({
								contents: ["childProcess error"]
							});
						} else {
							resolve(undefined);
						}
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});

function getNewCompletion(completionItemKind, label, documentationString) {
	vscode.CompletionItemKind;
	
	const newCompletion = new vscode.CompletionItem(label, completionItemKind);
	newCompletion.documentation = new vscode.MarkdownString(documentationString);
	return newCompletion;
}

vscode.languages.registerCompletionItemProvider('llcl', {
	async provideCompletionItems(document, position, token, context) {
		// get the document text (it may not have been saved to the file system yet)
		const text = document.getText();
		
		const line = position.line + 1;
		const character = position.character;
		console.log("line", line, "character", character);
		
		// get the compilerPath
		const compilerPath = getCompilerPath();
		
		return new Promise((resolve, reject) => {
			let gotData = false;
			try {
				const args = ["query", "suggestions", document.uri.path, text.length, line, character];
				console.log(compilerPath, args);
				const childProcess = child_process.spawn(compilerPath, args);
				
				childProcess.stdin.write(text);
				
				childProcess.on('error', (error) => {
					console.log(`error: ${error}`);
				});
				
				childProcess.stdout.on('data', (data) => {
					console.log("suggestions data", `${data}`);
					
					gotData = true;
					try {
						const array = JSON.parse(`${data}`);
						
						addDiagnostics(document.uri, array);
						
						let completionItems = [];
						
						for (let i = 0; i < array.length; i++) {
							const e = array[i];
							if (e[0] == 2) {
								completionItems.push(getNewCompletion(e[1], e[2], e[3]))	
							}
						}
						
						resolve(completionItems);
					} catch (error) {
						console.log(error);
						resolve(undefined);
					}
				});
				
				childProcess.on('close', (code) => {
					console.log(`process exited with code ${code}`);
					if (!gotData) {
						resolve(undefined);
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});

function reloadDiagnostics(uri, text) {
	const compilerPath = getCompilerPath();
	
	let gotData = false;
	try {
		const args = ["query", "diagnostics_only", uri.path, text.length];
		console.log(compilerPath, args);
		const childProcess = child_process.spawn(compilerPath, args);
		
		childProcess.stdin.write(text);
		
		childProcess.on('error', (error) => {
			console.log(`error: ${error}`);
		});
		
		childProcess.stdout.on('data', (data) => {
			console.log("diagnostics_only data", `${data}`);
			
			gotData = true;
			try {
				const array = JSON.parse(`${data}`);
				
				addDiagnostics(uri, array);
			} catch (error) {
				console.log(error);
			}
		});
		
		childProcess.on('close', (code) => {
			console.log(`process exited with code ${code}`);
		});
	} catch (error) {
		console.log(error);
	}
}

// vscode.workspace.onDidSaveTextDocument((document) => {
// 	reloadDiagnostics(document.uri, document.getText());
// })

// vscode.window.onDidChangeVisibleTextEditors((editors) => {
// 	// console.log("editors", editors);
// 	diagnosticCollection.clear();
	
// 	editors.forEach(editor => {
// 		if (editor.document.languageId == "llcl") {
// 			reloadDiagnostics(editor.document.uri, editor.document.getText());	
// 		}
// 	});
// });

// vscode.window.onDidChangeActiveTextEditor((editor) => {
// 	reloadDiagnostics(editor.document.uri, editor.document.getText());
// });

// start by looping over every file
vscode.workspace.textDocuments.forEach((document) => {
	if (document.languageId == "llcl") {
		reloadDiagnostics(document.uri, document.getText());	
	}
})

// when a file is opened
vscode.workspace.onDidOpenTextDocument((document) => {
	if (document.languageId == "llcl") {
		reloadDiagnostics(document.uri, document.getText());
	}
})

// when a file is changed
vscode.workspace.onDidChangeTextDocument(event => {
	if (event.document.languageId == "llcl") {
		reloadDiagnostics(event.document.uri, event.document.getText());
	}
});

// clear the errors when a file is closed
vscode.workspace.onDidCloseTextDocument((document) => {
	if (document.languageId == "llcl") {
		diagnosticCollection.set(document.uri, undefined);
	}
})