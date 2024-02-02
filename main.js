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
			let diagnostic = new vscode.Diagnostic(
				new vscode.Range(
					new vscode.Position(e[1] - 1, e[2]),
					new vscode.Position(e[1] - 1, e[3])
				),
				`error: ${e[4]};\n${e[5]}`
			)
			
			diagnosticList.push(diagnostic);
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

function runCompiler(args, stdin, callBack) {
	const compilerPath = getCompilerPath();
	
	let gotData = false;
	try {
		console.log(compilerPath, args);
		const childProcess = child_process.spawn(compilerPath, args);
		
		childProcess.stdin.write(stdin);
		
		childProcess.on('error', (error) => {
			console.log(`compiler error: ${error}`);
		});
		
		childProcess.stdout.on('data', (stdout) => {
			console.log("compiler stdout", `${stdout}`);
			
			gotData = true;
			try {
				callBack(stdout);
			} catch (error) {
				console.log(error);
			}
		});
		
		childProcess.on('close', (code) => {
			if (!gotData) {
				callBack(null);
			}
			console.log(`compiler exited with code: ${code}`);
		});
	} catch (error) {
		console.log(error);
	}
}

function reloadDiagnostics(uri, text) {
	runCompiler(["query", "diagnostics_only", uri.path, text.length], text, (stdout) => {
		const array = JSON.parse(`${stdout}`);
		console.log("array:", array);
		addDiagnostics(uri, array);
	});
}

//
// vscode.languages
//

vscode.languages.registerHoverProvider('llcl', {
	async provideHover(document, position, token) {
		// get the document text (it may not have been saved to the file system yet)
		const text = document.getText();
		
		// get the hover location
		const line = position.line + 1;
		const character = position.character;
		console.log("line", line, "character", character);
		
		return new Promise((resolve, reject) => {
			runCompiler(["query", "hover", document.uri.path, text.length, line, character], text, (stdout) => {
				if (stdout == null) {
					diagnosticCollection.clear();
					resolve({
						contents: ["childProcess error"]
					});
				}
				try {
					const array = JSON.parse(`${stdout}`);
					
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
						contents: ["provideHover error"]
					});
				}
			})
		});
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
			runCompiler(["query", "suggestions", document.uri.path, text.length, line, character], text, (stdout) => {
				try {
					const array = JSON.parse(`${stdout}`);
					
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
					console.error(error);
					resolve(undefined);
				}
			});
		})
	}
});

vscode.languages.registerCodeLensProvider('llcl', {
	provideCodeLenses(document, token) {
		reloadDiagnostics(document.uri, document.getText());
	},
	// resolveCodeLens(codeLens, token) {
	// 	console.log("resolveCodeLens", codeLens);
	// }
});

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
// vscode.workspace.textDocuments.forEach((document) => {
// 	if (document.languageId == "llcl") {
// 		reloadDiagnostics(document.uri, document.getText());	
// 	}
// })

// // when a file is opened
// vscode.workspace.onDidOpenTextDocument((document) => {
// 	if (document.languageId == "llcl") {
// 		reloadDiagnostics(document.uri, document.getText());
// 	}
// })

// // when a file is changed
// vscode.workspace.onDidChangeTextDocument(event => {
// 	if (event.document.languageId == "llcl") {
// 		reloadDiagnostics(event.document.uri, event.document.getText());
// 	}
// });

// clear the errors when a file is closed
vscode.workspace.onDidCloseTextDocument((document) => {
	if (document.languageId == "llcl") {
		diagnosticCollection.set(document.uri, undefined);
	}
})

//
// commands
//

let documentTextCallBack = () => {};

let textContentDidChangeEmitter = new vscode.EventEmitter();

vscode.workspace.registerTextDocumentContentProvider("llcl_document", {
	onDidChange: textContentDidChangeEmitter.event,
	provideTextDocumentContent(uri, token) {
		return documentTextCallBack();
	}
});

async function openDocument(name, callBack) {
	documentTextCallBack = callBack;
	
	const uri = vscode.Uri.parse(`llcl_document:${name}`);
	const doc = await vscode.workspace.openTextDocument(uri);
	textContentDidChangeEmitter.fire(uri);
	await vscode.window.showTextDocument(doc, {});
}

vscode.commands.registerCommand('extension.llcl.showLLVMIR', async () => {
	let editor = vscode.window.activeTextEditor;
	if (editor == undefined) {
		vscode.window.showErrorMessage('Editor is undefined!');
		return;
	}
	
	if (editor.document.languageId != "llcl") {
		vscode.window.showErrorMessage('editor.document.languageId != "llcl"');
		return;
	}
	
	let text = editor.document.getText();
	
	runCompiler(["query", "diagnostics_only", editor.document.uri.path, text.length, "-ir"], text, (stdout) => {
		let textUri = editor.document.uri.path.split("/").pop().split(".").shift() + ".txt";
		openDocument(textUri, () => {
			return `${stdout}`;
		})
	})
})