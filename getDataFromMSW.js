var http = require('http');
var AWS = require('aws-sdk');

var forecastData;
var params;

var docClient = new AWS.DynamoDB.DocumentClient();

AWS.config.update({
    region : 'ap-northeast-1'
});

exports.handler = (event, context, callback) => {

    // init variables
    var baseURL = 'magicseaweed.com';
    var basePath = '/api';
    var baseKey = 'YOURTOKENHERE'; // your token here!
    var apiPath = '/forecast/';
    var baseOptions = ['?spot_id=']; // API options can be added here -- http://magicseaweed.com/developer/forecast-api
    var spot_ids = [3705, 3706]; // list of spots
    var options = []; // options (URL, Path, Port, etc) for http requests
    var mswObj = []; // results from http requests
    var ctr = 0;

    // init options array
    for (var i = 0; i < spot_ids.length; i++) {
        completeOptions = baseOptions[0] + spot_ids[i];
        option = {
            host: baseURL,
            port: 80,
            path: basePath + baseKey + apiPath + completeOptions,
            method: 'GET'
          };
         options.push(option);
    }

    // describe functions
    makeRequest = function(reqOptions) {
        request = http.get(reqOptions[ctr], processResponse);
        request.on('error', logResponse);
    };

    processResponse = function (res) {
        var body = '';
        console.log('OPTIONS: ' + JSON.stringify(options));
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function(){
            mswObj.push([spot_ids[ctr], body]);
            //mswObj.push(JSON.parse(body));
            console.log('MSWOBJ: ' + mswObj[ctr]);
            ctr++;
            if (ctr == options.length) {
                console.log('DONE processing ' + (ctr) + ' requests!');
                //processData(mswObj);
                saveData(mswObj);
            } else {
                makeRequest(options);
            }
        });
    };

    logResponse = function (err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log('Saved data into DynamoDB');
            console.log(JSON.stringify(data));
        }
    };

    processData = function (obj) {
      for (var j = 0; j < obj.length; j++) {
        maxHeight = null;
        index = null;
        units = null;
        forecast = obj[j][1];
        swellDate = null;
        //console.log(forecast[0]);

        for (var k = 0; k < forecast.length; k++) {
          if (!maxHeight) {
            maxHeight = forecast[k].swell.maxBreakingHeight;
          } else if (maxHeight <= forecast[k].swell.maxBreakingHeight) {
            maxHeight = forecast[k].swell.maxBreakingHeight;
            index = k;
            units = forecast[k].swell.unit;
            swellDate = new Date(forecast[k].localTimestamp * 1000);
          }
        }

        console.log('Max Breaking Height for spot ' + obj[j][0] +  ' is ' + maxHeight + units + ' on ' + swellDate);
      }
    };

    saveData = function (JSONobj) {
        //set params

        params = {
            TableName : "forecast",
            Key : {
                "recordId" : 1,
            },
            UpdateExpression: "set forecastDate = :fdate, forecastData = :fdata",
            ExpressionAttributeValues : {
                ":fdate" : Date.now(),
                ":fdata" : JSONobj
            },
            ReturnValues : "UPDATED_NEW"
        };

        docClient.update(params, logResponse);
    };


    // start async requests
    makeRequest(options);
};
