//随着状态机逐步构造token里的内容
//每一个tag当做一个token去处理,在标签结束状态提交标签token
let currentToken = null;
let currentAttribute = null;
//处理属性之前处理标签的状态不够用，要添加新的状态,再把属性放到start tag上

//创建的所有token都要在同一个出口输出
function emit(token) {
    console.log(token); //之后再处理
}

const EOF = Symbol('EOF'); //EOF: End Of File
//判断是不是tag
//主要的标签有三种，开始标签，结束标签和自封闭标签
//如果是 <，则是标签开始，否则其余所有字符（除了eof）都可以被看作文本节点
function data(c) {
    if (c == "<") {
        return tagOpen;
    } else if (c == EOF) {
        emit({
            type: "EOF"
        });
        return;
    } else {
        //文本节点
        emit({
            type: "text",
            content: c //后面构造树的时候再把text拼接起来
        });
        return data;
    }
}
//标签开始（不是开始标签）
function tagOpen(c) {
    if (c == '/') {
        return endTagOpen;
    } else if (c.match(/^[a-zA-Z]$/)) {
        //这里可以对应开始标签或者自封闭标签
        //如果是自封闭之后用额外变量isSelfClosing来辨识
        //创建token开始
        currentToken = {
            type: "startTag",
            tagName: ""
        }
        //这里使用了reconsume逻辑
        return tagName(c);
    } else {
        return;
    }
}

function endTagOpen(c) {
    if (c.match(/^[a-zA-Z]$/)) {
        //创建token开始
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
    if (c.match(/^[\t\n\f ]$/)) { //有效的空白符：tab符，换行符，禁止符和空格
        return beforeAttributeName;
    } else if (c == "/") { //<html/>
        return selfClosingStartTag;
    } else if (c.match(/^[a-zA-Z]$/)) {
        currentToken.tagName += c;
        return tagName;
    } else if (c == ">") {
        emit(currentToken);//当前标签构造完毕
        return data;
    } else {
        return tagName;
    }
}

function beforeAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c == "/" || c == ">" || c == EOF) {
        return afterAttributeName(c);
    } else if (c == "=") {
        //属性不能在开头就是=
    } else {
        //遇到字符
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}
function attributeName(c) {
    if (c.match(/^[\t\n\f ]$/) || c == "/" || c == ">" || c == EOF) {
        return afterAttributeName(c);
    } else if (c == "=") {
        return beforeAttributeValue;
    } else if (c == "\u0000") {
        //这是null
    } else if (c == "\"" || c == "\'" || c == "<") {

    } else {
        currentAttribute.name += c;
        return attributeName;
    }
}

function beforeAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/) || c == "/" || c == ">" || c == EOF) {
        //为什么？
        return beforeAttributeValue;
    } else if (c == "\"") {
        return doubleQuotedAttributeValue;
    } else if (c == "\'") {
        return singleQuotedAttributeValue;
    } else if (c == ">") {
        //？？？？？和上面重复
    } else {
        return UnquotedAttributeValue(c);
    }
}

function doubleQuotedAttributeValue(c) {
    if (c == "\"") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c == "\u0000") {

    } else if (c == EOF) {

    } else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}

function singleQuotedAttributeValue(c) {
    if (c == "\'") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c == "\u0000") {

    } else if (c == EOF) {

    } else {
        currentAttribute.value += c;
        return singleQuotedAttributeValue;//这里样本写的double？
    }
}

function afterQuotedAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c == "/") {
        return selfClosingStartTag;
    } else if (c == ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c == EOF) {

    } else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}

function UnquotedAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    } else if (c == "/") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    } else if (c == ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c == "\u0000") {

    } else if (c == EOF) {

    } else if (c == "\"" || c == "'" || c == "<" || c == "=" || c == "`") {

    } else {
        currentAttribute.value += c;
        return UnquotedAttributeValue;//这里样本写的double？
    }
}

//从斜杠往后只有 > 是有效的，其他的都会报错
function selfClosingStartTag(c) {
    if (c == ">") {
        currentToken.isSelfClosing = true;
        emit(currentToken);
        return data;
    } else if (c == "EOF") {

    } else {

    }
}

function engTagOpen(c) {
    if (c.match(/^[a-zA-Z]$/)) {
        currentToken = {
            type: "engTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c == ">") {

    } else if (c == EOF) {

    } else {

    }
}

function afterAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return afterAttributeName;
    } else if (c == "/") {
        return selfClosingStartTag;
    } else if (c == "=") {
        return beforeAttributeValue;
    } else if (c == ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c == EOF) {

    } else {
        currentToken[currentAttribute.name] = currentAttribute.value;
        currentAttribute = {
            name: "",
            value: ""
        };
        return attributeName(c);
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

// function parseHTML(html) {
//     console.log(html)
//     let state = data;
//     for (let c of html) {
//         state = state(c);
//     }
//     state = state(EOF);
// }

// parseHTML(`<html maaa=a >
// <head>
//     <style>
// body div #myid{
//     width:100px;
//     background-color: #ff5000;
// }
// body div img{
//     width:30px;
//     background-color: #ff1111;
// }
//     <style>
// </head>
// <body>
//     <div>
//         <img id="myid"/>
//         <img />
//     <div>
// <body>
// </html>
// 0


// <html maaa=a >
// <head>
//     <style>
// body div #myid{
//     width:100px;
//     background-color: #ff5000;
// }
// body div img{
//     width:30px;
//     background-color: #ff1111;
// }
//     <style>
// </head>
// <body>
//     <div>
//         <img id="myid"/>
//         <img />
//     <div>
// <body>
// </html>`)

