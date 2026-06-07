const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(<!DOCTYPE html><p>Hello world</p>);
const document = dom.window.document;

function getTextFromEditable(td) {
    const clone = td.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('div, p').forEach(block => {
        block.prepend('\n');
        block.replaceWith(...block.childNodes);
    });
    clone.querySelectorAll('del').forEach(del => {
        const text = del.textContent;
        del.replaceWith(~~ + text + ~~);
    });
    return clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

const td = document.createElement('td');
td.innerHTML = "This is a <del>test</del> string";
console.log(getTextFromEditable(td));
