import assert from "node:assert/strict";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";

function compiledDocument(result, label) {
    if (!result.result) {
        result.printDiagnostics();
        throw new Error(`${label} did not produce a document`);
    }
    return result.result;
}

const compiler = NodeCompiler.create({ workspace: process.cwd() });
const versionDocument = compiledDocument(
    compiler.compile({
        mainFileContent: "#metadata(sys.version)<version>",
    }),
    "Typst version probe",
);
const versionResult = compiler.query(versionDocument, {
    selector: "<version>",
});
const version = versionResult?.[0]?.value;
assert.equal(version, "version(0, 15, 0)", `Expected embedded Typst 0.15.0, got ${version}`);

const svgDocument = compiledDocument(
    compiler.compile({
        mainFileContent: "#set page(width: 100pt, height: 40pt)\nCompatibility",
    }),
    "Rich SVG probe",
);
const svg = compiler.svg(svgDocument);
assert.match(svg, /class=["']typst-doc["']/);
assert.match(svg, /class=["']typst-text["']/);

console.log("Verified embedded Typst 0.15.0");
