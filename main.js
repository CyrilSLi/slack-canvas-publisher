require("dotenv").config();
const fs = require("node:fs");
const http = require("node:http");
const jsdom = require("jsdom");
const minify = require("html-minifier").minify;

async function generateCanvasHTML(fileID) {
    const xoxdToken = process.env.XOXD_TOKEN;
    const subdomain = process.env.SUBDOMAIN;
    const workspaceID = process.env.WORKSPACE_ID;

    const resp = await fetch(`https://${subdomain}.slack.com/docs/${workspaceID}/${fileID}/mobile`, {
        headers: {
            cookie: `d=${xoxdToken};`
        }
    });
    const document = new jsdom.JSDOM(await resp.text()).window.document;
    const styleEl = document.querySelector("head style");

    const fontStyles = {
        Regular: [400, "normal"],
        Bold: [700, "normal"],
        Black: [900, "normal"],
        Italic: [400, "italic"],
        BoldItalic: [700, "italic"],
        BlackItalic: [900, "italic"]
    }
    let fontCSS = [];
    ["Regular", "Bold", "Black", "Italic", "BoldItalic", "BlackItalic"].forEach((style) => {
        fontCSS.push(`
            @font-face {
                font-family: "Lato";
                src: url("/public/Lato/Lato-${style}.ttf") format("truetype");
                font-weight: ${fontStyles[style][0]};
                font-style: ${fontStyles[style][1]};
            }
        `);

    });
    ["Regular", "Bold", "Italic", "BoldItalic"].forEach((style) => {
        fontCSS.push(`
            @font-face {
                font-family: "Liberation Mono";
                src: url("/public/LiberationMono/LiberationMono-${style}.ttf") format("truetype");
                font-weight: ${fontStyles[style][0]};
                font-style: ${fontStyles[style][1]};
            }
        `);
    });
    styleEl.innerHTML += "\n" + fontCSS.join("\n");

    styleEl.innerHTML += `
        h1, h2, h3, h4, h5, h6, th {
            font-family: "Lato", sans-serif !important;
            font-weight: 900 !important;
        }
        body, p, ul, ol, td {
            font-family: "Lato", sans-serif !important;
            font-weight: 400 !important;
        }
        span.emoji {
            display: inline-block !important;
            transform: translateY(3px) !important;
            background-size: contain !important;
            margin: 0 0.05em !important;
        }
        code, pre {
            font-family: "Liberation Mono", monospace !important;
            background-color: rgb(248, 248, 248) !important;
            border: 1px solid rgb(221, 221, 221) !important;
        }
        code {
            padding: 2px 3px 1px !important;
            margin: 4px 0px !important;
            border-radius: 3px !important;
            color: rgb(224, 30, 90) !important;
        }
        pre.prettyprint:before {
            display: none !important;
        }
        pre.prettyprint {
            padding: 8px !important;
            border-radius: 4px !important;
        }
        ul li, p.line {
            margin-bottom: 6px !important;
        }
    `;

    const srcs = [];
    document.querySelectorAll("control > img").forEach((el) => {
        if (!srcs.includes(el.src)) {
            srcs.push(el.src);
        }
        el.nextSibling.remove();
        const emoji = document.createElement("span");
        emoji.classList.add("emoji", "emoji" + srcs.indexOf(el.src));

        el.removeAttribute("src");
        if (el.alt) {
            el.title = el.alt;
        }
        el.removeAttribute("alt");
        [...el.attributes].forEach((attr) => emoji.setAttribute(attr.name, attr.value));
        el.parentNode.parentNode.replaceChild(emoji, el.parentNode);
    });
    styleEl.innerHTML += "\n" + (await Promise.all(srcs.map(async (src, index) => {
        const resp = await fetch(decodeURIComponent(new URLSearchParams((new URL(src)).search).get("url")));
        return `
            span.emoji${index} {
                background-image: url("data:${resp.headers.get("content-type")};base64,${Buffer.from(await resp.arrayBuffer()).toString("base64")}");
            }
        `;
    }))).join("\n");

    document.querySelectorAll("script, li > br").forEach((el) => el.remove());
    document.querySelectorAll('*[id^="temp:"]').forEach((el) => el.removeAttribute("id"));
    document.querySelectorAll('*[class=""]').forEach((el) => el.removeAttribute("class"));
    document.querySelectorAll('*[data-is-slack=""]').forEach((el) => el.removeAttribute("data-is-slack"));
    document.querySelectorAll("a").forEach((el) => el.setAttribute("target", "_blank"));

    const canvasTitle = document.querySelector("h1")?.textContent?.trim();
    document.querySelector("head title").textContent = canvasTitle ? canvasTitle : "Slack Canvas";

    return minify(document.documentElement.outerHTML, {
        minifyCSS: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
    });
}

http.createServer(async (req, res) => {
    if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write(fs.readFileSync(process.cwd() + "/public/demo.html"));
    } else if (req.url.startsWith("/demo-load/F")) {
        const fileID = req.url.slice(req.url.lastIndexOf("/") + 1);
        if (!/^F[0-9A-Z]+$/.test(fileID)) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.write("Invalid file ID");
            res.end();
            return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write(await generateCanvasHTML(fileID));
    } else if (req.url.startsWith("/public/Lato/") && /Lato-[A-Za-z]+?\.ttf/.test(req.url.slice(13))) {
        const _ = [...fs.readdirSync(process.cwd() + "/public/Lato/")];
        res.write(fs.readFileSync(process.cwd() + req.url));
    } else if (req.url.startsWith("/public/LiberationMono/") && /LiberationMono-[A-Za-z]+?\.ttf/.test(req.url.slice(23))) {
        const _ = [...fs.readdirSync(process.cwd() + "/public/LiberationMono/")];
        res.write(fs.readFileSync(process.cwd() + req.url));
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.write("Not found");
    }
    res.end();
}).listen(process.env.PORT || 3000);