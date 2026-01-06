require("dotenv").config();
const dedent = require("dedent-js");
const fs = require("node:fs");
const jsdom = require("jsdom");

async function main() {
    const xoxdToken = process.env.XOXD_TOKEN;
    const subdomain = "hackclub.enterprise";
    const workspaceID = "T0266FRGM";
    const fileID = "F0A5Z6BKS1F"

    const resp = await fetch(`https://${subdomain}.slack.com/docs/${workspaceID}/${fileID}/mobile`, {
        headers: {
            cookie: `d=${xoxdToken};`
        }
    });
    const document = new jsdom.JSDOM(await resp.text()).window.document;

    document.querySelector("head style").innerHTML += dedent(`
        @font-face {
            font-family: "Lato";
            src: url("public/Lato/Lato-Regular.ttf") format("truetype");
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: "Lato";
            src: url("public/Lato/Lato-Bold.ttf") format("truetype");
            font-weight: bold;
            font-style: normal;
        }
        @font-face {
            font-family: "Lato";
            src: url("public/Lato/Lato-Italic.ttf") format("truetype");
            font-weight: normal;
            font-style: italic;
        }
        @font-face {
            font-family: "Lato";
            src: url("public/Lato/Lato-BoldItalic.ttf") format("truetype");
            font-weight: bold;
            font-style: italic;
        }
        h1, h2, h3, h4, h5, h6, th {
            font-family: "Lato", sans-serif !important;
            font-weight: bold !important;
        }
        body, p, ul, ol, td {
            font-family: "Lato", sans-serif !important;
            font-weight: normal !important;
        }
        img {
            display: inline !important;
            transform: translateY(3px) !important;
        }
    `);
    document.querySelectorAll("control > img").forEach((el) => {
        el.nextSibling.remove();
        el.parentNode.parentNode.replaceChild(el, el.parentNode);
    });
    document.querySelectorAll("script").forEach((el) => el.remove());

    fs.writeFileSync("out.html", document.documentElement.outerHTML);
}

main().catch(console.error);