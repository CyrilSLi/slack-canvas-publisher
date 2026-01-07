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

    styleEl.innerHTML += `
        @font-face {
            font-family: "Lato";
            src: url("/public/Lato/Lato-Regular.ttf") format("truetype");
            font-weight: 400;
            font-style: normal;
        }
        @font-face {
            font-family: "Lato";
            src: url("/public/Lato/Lato-Bold.ttf") format("truetype");
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: "Lato";
            src: url("/public/Lato/Lato-Black.ttf") format("truetype");
            font-weight: 900;
            font-style: normal;
        }
        @font-face {
            font-family: "Lato";
            src: url("/public/Lato/Lato-Italic.ttf") format("truetype");
            font-weight: 400;
            font-style: italic;
        }
        @font-face {
            font-family: "Lato";
            src: url("/public/Lato/Lato-BoldItalic.ttf") format("truetype");
            font-weight: 700;
            font-style: italic;
        }
        @font-face {
            font-family: "Lato";
            src: url("/public/Lato/Lato-BlackItalic.ttf") format("truetype");
            font-weight: 900;
            font-style: italic;
        }
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
        console.log("Serving font:", req.url, [...fs.readdirSync(process.cwd() + "/public/Lato/")]);
        res.write(fs.readFileSync(process.cwd() + req.url));
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.write("Not found");
    }
    res.end();
}).listen(process.env.PORT || 3000);