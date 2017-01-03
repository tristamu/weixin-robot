const electron = require('electron');

const fs = require('fs');

const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const https = require('https');

const http = require('http');

const url = require('url');

const xml2js = require('xml2js');

const querystring = require('querystring');

const crypto = require('crypto');

let mainWindow;

let ipc = require('electron').ipcMain;

var retry_time = 3;

var uuid;

var tip = 1;

var redirect_uri;

var skey,wxsid,wxuin,pass_ticket,webwx_data_ticket;

var device_id;

var syncKey = "";

var baseParams;

var myAccount;

var redirectUriObject;

var statusNotifyResult;

var groupList = new Array();

var groupMembers = {}

var encryChatRoomId = {};

//var host = ["webpush", "webpush2"];

var host = ["webpush2"];

var cookies = "";

var SyncKeyObj;

var newSyncKey = "";

var groups;

var syncFlag = false;

var syncOption;

function createWindow() {
    mainWindow = new BrowserWindow({width:800,height:600});

    mainWindow.loadURL(`file://${__dirname}/index.html`);

    ipc.on('show-qr-image',(event, data)=>{
        console.log("get message from client");
        event.sender.send('show-image');
    })

    mainWindow.webContents.openDevTools();
    mainWindow.on('closed',function(){
        mainWindow = null;
    });
}


function convertArrayToString(params) {
    var output = '?';
    for (var key in params) {
        output += key + '=' + params[key] + '&';
    }
    return output.substring(0, output.length - 1);
}

//时间格式化
Date.prototype.Format = function(fmt){
  var o = {   
    "M+" : this.getMonth()+1,                 //月份   
    "d+" : this.getDate(),                    //日   
    "h+" : this.getHours(),                   //小时   
    "m+" : this.getMinutes(),                 //分   
    "s+" : this.getSeconds(),                 //秒   
    "q+" : Math.floor((this.getMonth()+3)/3), //季度   
    "S"  : this.getMilliseconds()             //毫秒   
  };   
  if(/(y+)/.test(fmt))   
    fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));   
  for(var k in o)   
    if(new RegExp("("+ k +")").test(fmt))   
  fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));   
  return fmt;   
}  

function getUuid() {
    return new Promise((resolve, reject) => {
            //var url = 'https://login.weixin.qq.com/jslogin';
            var url = 'login.weixin.qq.com';
            var timestamp = new Date().getTime();
            var random = timestamp + Math.floor(Math.random() * 1000);

            var params = {
              'appid': 'wx782c26e4c19acffb',
              'fun': 'new',
              'lang': 'zh_CN',
              '_': random,
            }
            var paramsString = convertArrayToString(params);
            var options = {
                hostname: url,
                path: '/jslogin' + paramsString,
                method: 'GET',
            };

            var req = https.request(options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                  var pattern = /window.QRLogin.code = (\d+); window.QRLogin.uuid = "(\S+?)"/;
                  pattern.test(chunk);
                  uuid = RegExp.$2;
                  console.log(`origin uuid:${uuid}`);
                  resolve();
                });

                res.on('end', () => {
                  //console.log('No more data in response.');
                })
            });

            req.end();
        });
}

function createQRimage(){
    var uuidString = 'https://login.weixin.qq.com/l/' + uuid;
    var qr = require('qr-image');
    var qr_png = qr.image(uuidString, { type: 'png' });
    qr_png.pipe(require('fs').createWriteStream('login.png'));
}


function doRequestPromise(){
    return new Promise(function(resolve, reject){
        function doRequest(){
            console.log(`try_time:${retry_time}`);
            var login_url = 'login.weixin.qq.com';
            var code;
            var params = {
                'tip': tip,
                'uuid': uuid,
                '_': Math.round(new Date().getTime()/1000),
            };

            var paramsString = convertArrayToString(params);
            var options = {
                rejectUnauthorized:false,
                agent:false,
                hostname: login_url,
                path: '/cgi-bin/mmwebwx-bin/login' + paramsString,
                port: 443,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux i686; U;) Gecko/20070322 Kazehakase/0.4.5'
                }
            };

            var req = https.request(options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    var pattern_for_code = /window.code=(\d+);/;
                    pattern_for_code.test(chunk);
                    code = RegExp.$1;

                    var pattern_for_redirect_url = /window.redirect_uri="(\S+?)";/;
                    pattern_for_redirect_url.test(chunk);
                    redirect_uri = RegExp.$1;
                    redirectUriObject = url.parse(redirect_uri);
                });

                res.on('end', () => {
                    console.log(code);
                    if(code == 201){//scand
                        tip = 0;
                        console.log("scand");
                        doRequest();
                    }else if(code == 200){//success
                        console.log("success");
                        resolve();
                    }else if(code == 408 && retry_time > 0){//timeout
                        retry_time--;
                        setTimeout(doRequest,1000);
                    }else{
                        reject(408);
                    }
                })
            });

            req.on('error',(err)=>{
                console.log(err);
            })
            
            req.end();
        }
        doRequest();
    });
}


function loginPromise(){
    return new Promise(function(resolve, reject){       
        var options = {
            hostname: redirectUriObject.hostname,
            path: redirectUriObject.path,
            method: 'GET',
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                var loginCookies = res.headers['set-cookie'];
                loginCookies.forEach((element)=>{
                    var pattern = /^(\w+)=([a-z0-9A-Z_\+=/]+);/;
                    pattern.test(element);
                    var key = RegExp.$1;
                    var value = RegExp.$2;
                    cookies += key + "=" + value + "; ";
                });
                cookies = cookies.substr(0, cookies.length - 2);

                fs.writeFile('login.txt', chunk, 'utf8', ()=>{
                    //console.log("wirte message finish!");
                });

                parser = new xml2js.Parser();
                parser.parseString(chunk, function (err, result) {
                    skey = result.error.skey[0];
                    wxsid = result.error.wxsid[0];
                    wxuin = result.error.wxuin[0];
                    pass_ticket = result.error.pass_ticket[0];

                    device_id = Math.floor(Math.random() * 1000000000000000);
                    baseParams = {
                        "Uin":wxuin,
                        "Sid":wxsid,
                        "Skey":skey,
                        "DeviceID":device_id
                    };
                });
            });

            res.on('end', () => {
                resolve();
            });
        });

        req.end();
    });
}


function getSyncKey(){
    return new Promise(function(resolve, reject){
        var res_message = "";
        var postData = JSON.stringify({
            "BaseRequest":baseParams
        });
        var timestamp = new Date().getTime();
        timestamp = timestamp.toString().substr(0,10);

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxinit?r=" + timestamp + "&lang=en_US&pass_ticket=" + pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
            }
        }
        
        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in response.');
                fs.writeFile('message.txt', res_message, 'utf8', ()=>{
                    console.log("wirte message finish!");
                });
                
                res_obj = JSON.parse(res_message);
                myAccount = res_obj.User;
                SyncKeyObj = res_obj.SyncKey;

                for(var i = 0; i < res_obj.SyncKey.Count; i++){
                    syncKey += res_obj.SyncKey.List[i].Key + "_" + res_obj.SyncKey.List[i].Val + "|";
                }
                syncKey = syncKey.substr(0, syncKey.length - 1);
                if(res_obj.BaseResponse.Ret == 0){
                    console.log("get SyncKey success");
                    resolve();
                }else{
                    console.log("get SyncKey fail");
                    reject();
                }
            });
        });
        req.write(postData);
        req.end();
    });
}


function statusNotify(){
     return new Promise(function(resolve, reject){
        var res_message = "";
        var resObj;
        var timestamp = new Date().getTime();
        var clientMsgId = timestamp.toString().substr(0,10);
        var postData = JSON.stringify({
            "BaseRequest": baseParams,
            "Code": 3,
            "FromUserName": myAccount.UserName,
            "ToUserName": myAccount.UserName,
            "ClientMsgId":clientMsgId,
        });

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxstatusnotify?lang=zh_CN&pass_ticket=" + pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
            }
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in statusNotify.');
                resObj = JSON.parse(res_message);
                statusNotifyResult = resObj.BaseResponse.Ret;
                if(statusNotifyResult == 0){
                    resolve();
                }else{
                    reject();
                }
            });
        });

        req.write(postData);
        req.end();
     });
}

function getContact(){
    return new Promise(function(resolve, reject){
        var res_message = "";
        var resObj;
        var timestamp = new Date().getTime();
        var r = timestamp.toString().substr(0,10);
        var memberList;

        var postData = JSON.stringify({});

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxgetcontact?pass_ticket=" + pass_ticket + "&skey=" + skey + "&r=" + r,
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Cookie': cookies,
            }
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in response from getContact.');
                fs.writeFile('contact.txt', res_message, 'utf8', ()=>{
                    console.log("wirte contact finish!");
                });
                resObj = JSON.parse(res_message);
                memberList = resObj.MemberList;

                memberList.forEach((element)=>{
                    if(element.UserName.substr(0,2) === "@@"){
                        groupList.push(element);
                        fs.appendFile('groupList.txt', element.UserName + "\r\n", 'utf8', ()=>{
                            console.log("appendFile groupList finish!");
                        });
                    }
                });
                resolve();
            });
        });

        req.write(postData);
        req.end();
    });
    
}

function getAllGroupMembers(){
    return new Promise(function(resolve, reject){
        var resObj;
        var res_message = "";
        var timestamp = new Date().getTime();
        var r = timestamp.toString().substr(0,10);
        var groupNameList = new Array();
        groupList.forEach((element)=>{
            groupNameList.push({
                "UserName": element.UserName,
                "EncryChatRoomId": "",
            });
        });

        var postData = {
            "BaseRequest": baseParams,
            "Count": groupList.length,
            "List":groupNameList,
        };
        postData = JSON.stringify(postData);

        fs.writeFile('getAllGroupMembers_postdata.txt', postData, 'utf8', ()=>{
            console.log("wirte getAllGroupMembers_postdata finish!");
        });

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxbatchgetcontact?type=ex&r=" + r +"&pass_ticket=" + pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Cookie': "wxsid=" + wxsid + "; " + "wxuin=" + wxuin
            }
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in response from getAllGroupMembers.');
                
                fs.writeFile('AllGroupMembers.txt', res_message, 'utf8', ()=>{
                    console.log("wirte AllGroupMembers finish!");
                });
                
                resObj = JSON.parse(res_message);
                resObj.ContactList.forEach((element)=>{
                    //groupMembers[element.UserName] = element.MemberList;
                    groupMembers[element.UserName] = element;
                    encryChatRoomId[element.UserName] = element.EncryChatRoomId;
                });

                fs.writeFile('groupMembers.txt', JSON.stringify(groupMembers), 'utf8', ()=>{
                    console.log("wirte groupMembers finish!");
                });

                mainWindow.webContents.send('sendGroupMembers', JSON.stringify(groupMembers));
                console.log("ipc sending finish")

                /*
                fs.writeFile('encryChatRoomId.txt', JSON.stringify(encryChatRoomId), 'utf8', ()=>{
                    console.log("wirte encryChatRoomId finish!");
                });
                */
                resolve();
            });
        });

        req.write(postData);
        req.end();
    });
}


//检测是否有新的消息
function testSync(){
    return new Promise(function(resolve, reject){
        var resMessage = "";
        var timestamp = new Date().getTime();
        var timestamp = timestamp.toString().substr(0,13);

        var timestamp2 = new Date().getTime();
        var timestamp2 = timestamp2.toString().substr(0,13);
        var params = {
            'r': timestamp,
            'sid': wxsid,
            'uin': wxuin,
            'skey': skey,
            'deviceid': device_id,
            'synckey': syncKey,
            '_': timestamp2,
        };

        var paramsString = querystring.stringify(params);

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            path: "/cgi-bin/mmwebwx-bin/synccheck?" + paramsString,
            method: 'GET',
            timeout: 60000,
            headers: {
                'Cookie': cookies,
            }
        };

        var hostIndex = 0;
        function testSyncRequest(){
            options.hostname = host[hostIndex] + ".weixin.qq.com";
            //console.log(options);
            var req = https.request(options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    resMessage = chunk;
                });
                res.on('end', () => {
                    console.log(resMessage);
                    var pattern = /^window.synccheck={retcode:"(\d+)",selector:"(\d+)"/;
                    pattern.test(resMessage);
                    var retcode = RegExp.$1;
                    var selector = RegExp.$2;
                    //console.log(resMessage);
                    if(retcode === "0"){
                        if(selector === "0"){
                            testSyncRequest();
                        }else{
                            //console.log("sync test success");
                            resolve(selector);
                        }
                    }else if(hostIndex < host.length - 1){
                        hostIndex ++;
                        //console.log("sync test fail");
                        testSyncRequest();
                    }else{
                        reject();
                    }
                });
            });
            req.end();
        }
        testSyncRequest();
    });
}


//TODO:这里还有set-cookie操作，要把该内容添加进去
function getMessageType(selector){
    return new Promise(function(resolve, reject){
        var timestamp = new Date().getTime();
        timestamp = timestamp.toString().substr(0,10);
        var postData = {
            "BaseRequest": baseParams,
            "SyncKey": SyncKeyObj,
            "rr": ~parseInt(timestamp),
        };
        postData = JSON.stringify(postData);

        fs.writeFile('syncPostData.txt', postData, 'utf8', ()=>{
            //console.log("wirte syncPostData.txt finish!");
        });

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxsync?sid=" + wxsid + "&skey=" + skey +"&lang=en_US&pass_ticket=" + pass_ticket,
            method: 'POST',
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Cookie': cookies,
            }
        }

        var req = https.request(options, (res) => {
            var resMessage = "";
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                resMessage += chunk;
            });
            res.on('end', () => {
                var syncCookies = res.headers['set-cookie'];
                syncCookies.forEach((element)=>{
                    var pattern = /^(\w+)=([a-z0-9A-Z_\+=/]+);/;
                    pattern.test(element);
                    var key = RegExp.$1;
                    var value = RegExp.$2;
                    if(key === "webwx_data_ticket"){
                        webwx_data_ticket = value;
                    }
                });
                
                fs.writeFile('syncResponseData.txt', resMessage, 'utf8', ()=>{
                    //console.log("wirte syncResponseData finish!");
                });
                var responseObj = JSON.parse(resMessage);
                if(responseObj.BaseResponse.Ret == 0){
                    newSyncKey = "";
                    for(var i = 0; i < responseObj.SyncKey.Count; i++){
                        newSyncKey += responseObj.SyncKey.List[i].Key + "_" + responseObj.SyncKey.List[i].Val + "|";
                    }
                    newSyncKey = newSyncKey.substr(0, newSyncKey.length - 1);

                    syncKey = newSyncKey;
                    SyncKeyObj = responseObj.SyncKey;
                    console.log("update synckey");
                    getMessage();
                    
                    switch(selector){
                        case "2"://新的消息
                            resolve(responseObj);
                            break;
                        case "4":
                            //通讯录更新
                            break;
                        case "7":
                            //手机上操作过
                            break;
                        default:
                            break;
                    }
                }else{
                    //reject();
                }
            });
        });
        req.write(postData);
        req.end();
    }); 
}

//根据用户ID发送消息
function sendMessageById(content,destinationId) {
    var timestamp = new Date().getTime();
    var clientMsgId = timestamp.toString().substr(0,17) + Math.random().toString().substr(-4);
    content = content.replace(/<br\/>/g, "\n");

    var postData = JSON.stringify({
        "BaseRequest": baseParams,
        "Msg": {
            "Type": 1,
            "Content":content,
            "FromUserName":myAccount.UserName,
            "ToUserName":destinationId,
            "LocalID": clientMsgId,
            "ClientMsgId": clientMsgId,
        },
        "Scene":0
    });

    postData = new Buffer(postData,"utf8");

    fs.appendFile('sendMessageById_postdata.txt', postData + "\r\n", 'utf8', ()=>{
        console.log("wirte sendMessageById_postdata.txt finish!");
    });

    var options = {
        //rejectUnauthorized:true,
        agent:false,
        hostname: redirectUriObject.hostname,
        path: "/cgi-bin/mmwebwx-bin/webwxsendmsg?lang=zh_CN&pass_ticket=" + pass_ticket,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Content-Length': postData.length,
            'Cookie': cookies,
        }
    };

    fs.writeFile('sendMessageById_option.txt', JSON.stringify(options), 'utf8', ()=>{
        console.log("wirte sendMessageById_option.txt finish!");
    });

    var resMessage = "";
    
    var req = https.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            resMessage += chunk;
        });
        res.on('end', () => {
            console.log(resMessage);

        });
    });
    req.write(postData);
    req.end();
}

//根据用户的id发送图片
function sendImageById(content,destinationId){

}

//通过xml格式的消息下载图片
function getImage(msgID){
    var options = {
        //rejectUnauthorized:true,
        agent:false,
        hostname: redirectUriObject.hostname,
        path: "/cgi-bin/mmwebwx-bin/webwxgetmsgimg?MsgID=" + msgID + "&skey=" + skey,
        //method: 'GET',
        headers: {
            //'Content-Type': 'application/json;charset=UTF-8',
            //'Content-Length': postData.length,
            'Cookie': cookies,
        }
    };

    var file = fs.createWriteStream(msgID + ".png");
    var request = https.get(options, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close();  // close() is async, call cb after close completes.
        }).on('error', function(err) {
            console.log("wirte png file error");
            fs.unlink(msgID + ".png");
        });
    });
    
}

//上传文件
function uploadFile(filePath,targetGroup){
    var filename = filePath.substr(filePath.indexOf("/",filePath.length - 1));
    var filesize;

    fs.stat(filePath, (err, stats) => {
        if (err) throw err;
        filesize = stat.size;
    });

    var MD5 = crypto.createHash('MD5');
    var FileMd5;

    var input = fs.createReadStream(filePath);
    input.on('readable', () => {
        var data = input.read();
        if (data)
            MD5.update(data);
        else {
            FileMd5 = MD5.digest('hex');
            console.log(MD5.digest('hex'));
            //console.log(`${MD5.digest('hex')} ${filename}`);
        }
    });

    //TODO:判断文件的mime
    var filetype;
    var mediatype = "pic";

    var options = {
        //rejectUnauthorized:true,
        agent:false,
        hostname: "file" + redirectUriObject.hostname,
        path: "/cgi-bin/mmwebwx-bin/webwxuploadmedia?f=json",
        headers: {
            //'Content-Type': 'application/json;charset=UTF-8',
            //'Content-Length': postData.length,
            'Cookie': cookies,
        }
    };

    var req = request.post(options, function (err, resp, body) {
        if (err) {
            console.log('Error!');
        } else {
            console.log('URL: ' + body);
        }
    });

    var timeFormated = new Date().format("yyyy-MM-dd HH:mm:ss");
    timeFormated = timeFormated + " GMT+0800 (CST)";

    var form = req.form();
    form.append("id","WU_FILE_2");
    form.append("name",filename);
    form.append("type","image/png");
    form.append("lastModifiedDate", timeFormated);
    form.append("size",filesize);
    form.append("mediatype",mediatype);
    form.append("pass_ticket",pass_ticket);
    form.append("webwx_data_ticket",webwx_data_ticket);
    form.append("uploadmediarequest",{
            "UploadType": 2,
            "BaseRequest": baseParams,
            "ClientMediaId": new Date().getTime(),
            "TotalLen": filesize,
            "StartPos": 0,
            "DataLen": filesize,
            "MediaType": 4,
            "FromUserName": myAccount.UserName,
            "ToUserName": targetGroup,
            "FileMd5": FileMd5
    });
    form.append('filename', fs.createReadStream(filePath));

    //https://github.com/form-data/form-data
    var uploadUrl = 'https://file.'+ redirect_uri +'/cgi-bin/mmwebwx-bin/webwxuploadmedia?f=json';
    form.submit(uploadUrl, function(err, res) {
         if (err) throw err;
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            resMessage += chunk;
        });
        res.on('end', () => {
            console.log(resMessage);
        });

        //res.resume();
    });

}


function handleMessage(messageObj){
    messageObj.AddMsgList.forEach((message)=>{
        if(syncFlag){
            if(message.FromUserName.substr(0,2) === "@@"){//群消息
                if(message.FromUserName === syncOption.sourceGroupSelected){//消息来源于指定的群
                    syncOption.sourceMemberSelected.forEach((sourceMemberSelected)=>{
                        if(message.Content.substr(0,message.Content.indexOf(":")) === sourceMemberSelected){
                            syncOption.targetGroupSelected.forEach((targetGroup)=>{
                                var realContent = message.Content.substr(message.Content.indexOf(">")+1);
                                if(message.MsgType === 1){//1表示文本
                                    sendMessageById(realContent, targetGroup);
                                }
                                
                                if(message.MsgType === 3){//3表示图片
                                    getImage(message.MsgId);
                                    //sendImageById(realContent, targetGroup);
                                }
                            });
                        }
                    });
                }
            }
        }else{
            console.log("syncFlag is false");
        }
    });
}

function getSyncOption(){
    ipc.on('sendSyncOption', (event, arg) => {
        fs.writeFile('SyncOption.txt', arg, 'utf8', ()=>{
            console.log("wirte SyncOption.txt finish!");
        });
        syncOption = JSON.parse(arg);
        syncFlag = true;
    });
}


function getMessage(){
    var testSyncPromise = testSync();
    testSyncPromise.then((selector)=>{
        console.log("testSync OK");
        //console.log(`selector is ${selector}`);
        return getMessageType(selector);
    },()=>{console.log("testSync not OK");})
    .then((responseObject)=>{
        handleMessage(responseObject);
    })
}


function processMessage(){
    getSyncOption();

    getMessage();
    //setInterval(getMessage,1000);

}

app.on('ready',()=>{
  var promise = getUuid();
  promise.then(createQRimage).then(createWindow).then(doRequestPromise).then(loginPromise,(reject_code)=>{
      console.log(`reject_code is:${reject_code}`);
  }).then(getSyncKey)
  .then(statusNotify)
  .then(getContact)
  .then(getAllGroupMembers)
  .then(processMessage);
})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});