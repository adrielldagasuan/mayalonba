"use strict";

var http = require('https');
var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
AWS.config.update({
    region : 'ap-northeast-1'
});

var APIToken = '<<YOURTOKENHERE>>';
var baseURL = 'api.telegram.org';

// define variables
var params = {};
var postData = {};
var mswData;
var messages = [];
var options;
var spots = {};
spots[3705] = 'Baler';
spots[3706] = 'LU';
var processDone = false;

// define functions

// options for sending replies using the telegram API
var getOptions = function(method, postParams){
    return {
        host: baseURL,
        port: 443,
        path: APIToken + method,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(postParams))
        }
    };
};

var sendGif = function(data){
  data.document = "https://media.giphy.com/media/RMfTVxILkMWUE/giphy.gif";
  options = getOptions('/sendDocument',data);
  sendReply(options);
};


// process data from dynamoDB
var processData = function (err, data) {
  if (err) {
      console.log(err);
  } else {

      var obj = JSON.parse(JSON.stringify(data));
      var text = '';
      var maxHeight = null;
      var index = null;
      var units = null;
      var forecast = null;
      var swellDate = null;

      for (var j = 0; j < obj.Item.forecastData.length; j++) {
        maxHeight = null;
        index = null;
        units = null;
        forecast = JSON.parse(obj.Item.forecastData[j][1]);
        swellDate = null;

        for (var k = 0; k < forecast.length; k++) {
          if (!maxHeight) {
            maxHeight = forecast[k].swell.maxBreakingHeight;
            index = k;
          } else if (maxHeight <= forecast[k].swell.maxBreakingHeight) {
            maxHeight = forecast[k].swell.maxBreakingHeight;
            index = k;
          }

          units = forecast[index].swell.unit;
          swellDate = new Date(forecast[index].timestamp * 1000);
        }
        text += 'Max Breaking Height for spot ' + spots[obj.Item.forecastData[j][0]] +  ' is ' + maxHeight + units + ' on ' + swellDate + '\n';
      }
  }
  postData.text = text;
  sendReply(getOptions('/sendMessage',postData));

};

//send replies using telegram API
var sendReply = function(options) {
    var request = http.request(options, function (res) {

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('BODY: ' + chunk);
        });
    });

    request.on('error', function(err) {
        console.log(err);
    });

    console.log(JSON.stringify(postData));
    request.write(JSON.stringify(postData));
    request.end();
};

exports.handler = (event, context, callback) => {

    console.log('EVENT:' + JSON.stringify(event));
    console.log('CONTEXT:' + JSON.stringify(context));

    var commands = [];
    var isValid = false;

    // main

    postData.chat_id = event.message.chat.id;

    if (event.message.entities && event.message.entities[0].type == "bot_command") {
        commands = event.message.text.split(" ", (event.message.text.match(/\s/g) || []).length + 1);
        isValid = true;
    } else { // if not a valid command
        sendGif(postData);
        isValid = false;
    }

    if (isValid && commands[0]) { // if it is a valid command
        if (commands[0].toUpperCase() == "/MAYALONBA" || commands[0].toUpperCase() == "/MAYALONBA@MAYALONBOT") {
            if (commands[1]) {
                sendGif(postData);
            } else if (!commands[1]) {
                // get data from dynamodb and then process data
                params = {
                    TableName : 'forecast',
                    Key : {
                        recordId : 1
                    }
                };
                docClient.get(params, processData);
            }
        } else {
            sendGif(postData);
        }
    }
};
