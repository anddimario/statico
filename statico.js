'use strict';
const AWS = require('aws-sdk');
const handlebars = require('handlebars');
const fs = require('fs');
const { promisify } = require('util');
const axios = require('axios');

//http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html
AWS.config.loadFromPath('aws-keys.json');
AWS.config.update({
  region: process.env_AWS_REGION
});


const dynamodb = new AWS.DynamoDB.DocumentClient(JSON.parse(process.env.DYNAMO_OPTIONS));
const s3 = new AWS.S3(JSON.parse(process.env.S3_OPTIONS));

const readFile = promisify(fs.readFile);

async function getTemplateHtml(file, params) {
  try {
    const template = await readFile(`./templates/${file}.html`, 'utf8');
    const compiled = handlebars.compile(template);
    const emailHtml = compiled(params);
    return emailHtml;
  } catch (e) {
    throw e;
  }
}

async function getAllConfig(params, key) {
  try {
    let scanAgain = true;
    let allConfigs = [];
    while (scanAgain) {
      if (key) {
        params.ExclusiveStartKey = key;
      }
      const response = await dynamodb.scan(params).promise();
      allConfigs = allConfigs.concat(response.Items);
      scanAgain = response.LastEvaluatedKey;
      key = scanAgain;
    }
    return allConfigs;
  } catch (e) {
    throw e;
  }
}

async function getAllFromDynamo(params, key) {
  try {
    let scanAgain = true;
    let allConfigs = [];
    while (scanAgain) {
      if (key) {
        params.ExclusiveStartKey = key;
      }
      const response = await dynamodb.scan(params).promise();
      allConfigs = allConfigs.concat(response.Items);
      scanAgain = response.LastEvaluatedKey;
      key = scanAgain;
    }
    return allConfigs;
  } catch (e) {
    throw e;
  }
}

async function main() {
  try {
    // get from dynamodb
    const configs = await getAllConfig({
      TableName: 'statico_config',
    });
    for (const config of configs) {
      let locals;
      // get informations from dynamodb or endpoint
      if (config.type === 'curl') {
        locals = await axios.get(config.source);
      } else if (config.type === 'dynamodb') {
        const params = {
          TableName: config.source,          
        };
        if (config.lastRun) {
          params.FilterExpression = 'modifiedAt > :lastRun';
          params.ExpressionAttributeValues = {
            ':lastRun': config.lastRun
          };
        }
        locals = await getAllFromDynamo(params);
      } else {
        continue;
      }
      for (const local of locals) {
        // create static
        const html = await getTemplateHtml(config.template, local);
        const base64data = Buffer.from(html);
        const slug = config.fieldForSlug.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
          .replace(/\s+/g, '-') // collapse whitespace and replace by -
          .replace(/-+/g, '-'); // collapse dashes
        // send to s3
        await s3.putObject({
          Bucket: config.destination,
          Key: `${slug}.html`, 
          Body: base64data,
          ACL: 'public-read'
        }).promise();

      }
      if (config.type === 'dynamodb') {
        // update on dynamo last run
        await dynamodb.update({
          TableName: 'statico_config',
          Key: {
            id: config.id,
          },
          UpdateExpression: "SET lastRun = :lastRun",
          ExpressionAttributeValues: {
            ':lastRun': Date.now()
          },
        }).promise()

      }
    }
    return;
  } catch (err) {
    console.log(err);
    process.exit(1);
  }

}

main()