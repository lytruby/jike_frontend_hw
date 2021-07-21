const css = require('css');
const EOF = Symbol('EOF'); //EOF: End Of File
//随着状态机逐步构造token里的内容
//每一个tag当做一个token去处理,在标签结束状态提交标签token
let currentToken = null;
let currentAttribute = null;
//处理属性之前处理标签的状态不够用，要添加新的状态,再把属性放到start tag上

let stack = [{ type: "document", children: [] }];
//文本节点用textnode来处理
let currentTextNode = null;

//加入一个新的函数，addCSSRules，把css规则暂存到一个rules数组里 
let rules = [];
function addCSSRules(text) {
    //把文本变成ast再保存
    var ast = css.parse(text);
    //选择器+花括号 为一条规则
    //css自带的parse里不能分开空格分隔的选择器，需要调用selector库
    //每一个规则都是一个对象，添加进array

    //数组展开展开变成push的参数
    // console.log(JSON.stringify(ast, null, " "))
    rules.push(...ast.stylesheet.rules);
}

//这里假设所有的selector都是简单选择器，类选择器，id选择器或者标签选择器
function match(element, selector) {
    if (!selector || !element.attributes) //排除文本节点
        return false;
    if (selector.charAt(0) == '#') {
        var attr = element.attributes.filter(attr => attr.name === "id")[0]
        if (attr && attr.value === selector.replace("#", ''))
            return true;
    } else if (selector.charAt(0) == ".") {
        //看一下filter
        var attr = element.attributes.filter(attr => attr.name === "class")[0]
        if (attr && attr.value === selector.replace(".", ''))
            return true;
    } else {
        if (element.tagName === selector) {
            return true;
        }
    }
    return false;
}

function specificity(selector) {
    //inline id class tag
    var p = [0, 0, 0, 0];
    var selectorParts = selector.split(" ");
    for (var part of selectorParts) {
        if (part.charAt(0) == "#") {
            p[1] += 1;
        } else if (part.charAt(0) == ".") {
            p[2] += 1;
        } else {
            p[3] += 1;
        }
    }
    return p;
}

function compare(sp1, sp2) {
    //只要不是0就不需要往下比较
    if (sp1[0] - sp2[0])
        return sp1[0] - sp2[0];
    if (sp1[1] - sp2[1])
        return sp1[1] - sp2[1];
    if (sp1[2] - sp2[2])
        return sp1[2] - sp2[2];

    return sp1[3] - sp2[3];
}

function computeCSS(element) {
    // console.log(rules);
    // console.log("compute CSS for Element", element);
    //这里取的是父元素
    var elements = stack.slice().reverse();

    if (!element.computedStyle)
        //给元素加上computedstyle属性
        element.computedStyle = {};

    for (let rule of rules) {
        var selectorParts = rule.selectors[0].split(" ").reverse();
        //看当前元素和选择器最内层是否匹配
        if (!match(element, selectorParts[0]))
            continue;

        let matched = false;

        var j = 1;
        for (var i = 0; i < elements.length; i++) {
            if (match(elements[i], selectorParts[j])) {
                j++;
            }
        }
        //所有的选择器都被匹配到
        if (j >= selectorParts.length)
            matched = true;

        if (matched) {
            var sp = specificity(rule.selectors[0]);
            var computedStyle = element.computedStyle;
            for (var declaration of rule.declarations) {
                if (!computedStyle[declaration.property])
                    //这里不直接添加value的原因是还要添加别的属性
                    computedStyle[declaration.property] = {};

                if (!computedStyle[declaration.property].specificity) {
                    computedStyle[declaration.property].value = declaration.value;
                    computedStyle[declaration.property].specificity = sp;
                } else if (compare(computedStyle[declaration.property].specificity, sp) < 0) {
                    computedStyle[declaration.property].value = declaration.value;
                    computedStyle[declaration.property].specificity = sp;
                }

            }
            // console.log(element.computedStyle);
            // console.log("element", element, "matched rule", rule);
        }
    }
}
//创建的所有token都要在同一个出口输出
function emit(token) {
    let top = stack[stack.length - 1];

    if (token.type === "startTag") {
        let element = {
            type: "element",
            children: [],
            attributes: []
        }
        element.tagName = token.tagName;
        for (p in token) {
            if (p !== "type" && p !== "tagName")
                element.attributes.push({
                    name: p,
                    value: token[p]
                });
        }

        computeCSS(element);

        top.children.push(element);
        element.parent = top;

        if (!token.isSelfClosing)
            stack.push(element);

        currentTextNode = null; //无论是开始标签还是自封闭标签之后都要把文本节点清空

    } else if (token.type === "endTag") {
        if (top.tagName !== token.tagName) {
            // console.log(top.tagName);
            // console.log(token.tagName);
            throw new Error("Tag start end doesn't match");
        } else {
            //++++++++++++++遇到style标签，执行添加css规则的操作+++++++++++++//
            if (top.tagName === "style") {
                addCSSRules(top.children[0].content);
            }
            stack.pop();
        }
        currentTextNode = null; //结束标签之后也把文本节点清空
        //文本节点的逻辑
    } else if (token.type === "text") {
        if (currentTextNode == null) {
            currentTextNode = {
                type: "text",
                content: ""
            }
            top.children.push(currentTextNode);
        }
        currentTextNode.content += token.content;//当前的文本节点追加content
        //top.children 里的textNode 会自己update吗?
    }
}


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
    // console.log(html)
    let state = data;
    for (let c of html) {
        state = state(c);
    }
    state = state(EOF);
    return stack[0];
}

// function parseHTML(html) {
//     // console.log(html);
//     let state = data;
//     for (let c of html) {
//         state = state(c);
//     }
//     state = state(EOF);
//     return stack[0];
// }

// parseHTML(
//     `<html maaa=a >
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
//     </style>
// </head>
// <body>
//     <div>
//         <img id="myid"/>
//         <img />
//     </div>
// </body>
// </html>`)

