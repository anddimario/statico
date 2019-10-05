Get details from a dynamodb table, or a curl and create static file in s3, in a serverless way with aws (batch, dynamodb, lambda and s3). Templating system is based on handlebars.

### Install
- `npm i --production`
- create an `aws-keys.json` with your credentials, see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html
- send on aws:
```
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="..."
export AWS_REGION="..."
export TF_VAR_aws_region=your_region
export TF_VAR_docker_image=your_ecr_image_path
terraform apply
```

### How it works
- store your template in `templates/`
- store on dynamodb the config payload that changed based on the system you choose (dynamodb or curl):
```
{
    id: ...,
    type: ..., // curl or dynamodb
    source: ..., // url if curl, a table name for dynamodb
    template: ...,
    destination: ..., // s3 destination
    fieldForSlug: ... // field used to create file as slug
}

```
- only for **dynamodb** your content table should be a dynamodb table with `modifiedAt` field:
```
{
  ....
  modifiedAt: '',
}
```

### Development and local testing
- install https://github.com/localstack/localstack/
- install aws cli
- start localstack:
```
export SERVICES=dynamodb,s3
docker-compose up
```
- create a bucket:
```
aws s3 --endpoint=http://localhost:4572 mb s3://my_bucket
```
- create the dynamodb table for config:
```
aws dynamodb create-table --endpoint=http://localhost:4569 --table-name statico_config --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```
- insert a record in dynamodb config:
```
aws dynamodb put-item --endpoint=http://localhost:4569 --table-name statico_config --item file://item.json
```
example of item.json for dynamodb:
```
{
  "id": {
    "S": "test"
  },
  "source": {
    "S": "my_content_table"
  },
  "type": {
    "S": "dynamodb"
  },
  "template": {
    "S": "testtemplate"
  },
  "destination": {
    "S": "my_bucket/my_path/"
  },
  "fieldForSlug": {
    "S": "title"
  }
}
```
- create a template in `templates/`, example for `testtemplate.html`:
```
This is to see if it's {{ test }}
```
- create a table for test:
```
aws dynamodb create-table --endpoint=http://localhost:4569 --table-name my_content_table --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```
- insert a record for content:
```
aws dynamodb put-item --endpoint=http://localhost:4569 --table-name my_content_table --item file://item.json
```
example of item.json for dynamodb:
```
{
  "id": {
    "S": "test"
  },
  "title": {
    "S": "My test"
  },
  "test": {
    "S": "prova"
  }
}
```

#### Build on localhost
- go in the project root
- build the image: `docker build -t statico .`
- run the image: 
```
docker run --network="host" -e DYNAMO_OPTIONS='{"endpoint":"http://localhost:4569"}' -e S3_OPTIONS='{"endpoint":"http://localhost:4572"}' -e AWS_REGION='localhost' -t statico
```
