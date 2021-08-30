# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## GitHubのpersonal access tokenの生成と Secretへの登録

https://docs.aws.amazon.com/ja_jp/codepipeline/latest/userguide/appendix-github-oauth.html

```
aws secretsmanager create-secret --name GitHubToken --secret-string XXXXXXYYYYYYYYYZZZZZZ
aws secretsmanager create-secret --name SlackSettings --secret-string file://slack.json
```

```json
{
  "channel_configuration_name": "xxx",
  "workspace_id": "xxx",
  "channel_id": "xxxx"
}
```


## 参考にした資料
