//随着状态机逐步构造token里的内容
let currentToken = null;

//创建的所有token都要在同一个出口输出
function emit(token) {
    console.log(token);
}

const EOF = Symbol('EOF'); //EOF: End Of File
//判断是不是tag
//如果是 <，则是标签开始，否则其余所有字符（除了eof）都可以被看作文本节点
function data(c) {
    if (c == "<") {
        return tagOpen;
    } else if (c == EOF) {
        return;
    } else {
        //文本节点
        return data;
    }
}
//标签开始（不是开始标签）
function tagOpen(c) {
    if (c == '/') {
        return endTagOpen;
    } else if (c.match(/^[a-zA-Z]$/)) {
        //这里使用了reconsume逻辑
        return tagName(c);
    } else {
        return;
    }
}

function endTagOpen(c) {
    if (c.match(/^[a-zA-Z]$/)) {
        currentToken = {
            type: "endTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c == ">") {

    } else if (c == EOF) {

    } else {

    }
}

function tagName(c) {
    if (c.macth(/^[\t\n\f ]$/)) { //有效的空白符：tab符，换行符，禁止符和空格
        return beforeAttributeName;
    } else if (c == "/") { //<html/>
        return selfClosingStartTag;
    } else if (c.macth(/^[a-zA-Z]$/)) {
        return tagName;
    } else if (c == ">") {
        return data;
    } else {
        return tagName;
    }
}

//死等右尖括号
function beforeAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c == ">") {
        return data;
    } else if (c == "=") {
        return beforeAttributeName;
    } else {
        return beforeAttributeName;
    }
}

//从斜杠往后只有 > 是有效的，其他的都会报错
function selfClosingStartTag(c) {
    if (c == ">") {
        currentToken.isSelfClosing = true;
        return data;
    } else if (c == "EOF") {

    } else {

    }
}

module.exports.parseHTML = function parseHTML(html) {
    console.log(html)
    let state = data;
    for (let c of html) {
        state = state(c);
    }
    state = state(EOF);
}

