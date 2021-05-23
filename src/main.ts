#!/usr/bin/env node
import { readFileSync } from 'fs';
import { Rule, Schedule } from '@aws-cdk/aws-events';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';
import { IRole, PolicyStatement, Role, ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam';
import { Function, Runtime, InlineCode } from '@aws-cdk/aws-lambda';
import { App, Duration, Environment, Stack, Construct, StackProps } from '@aws-cdk/core';

// IAM Stack
export class IamRoleStack extends Stack {
  public readonly lambdarole: Role;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // IAM Role Lambda Execute
    this.lambdarole = new Role(this, 'IamRoleLambda', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    this.lambdarole.addToPolicy(new PolicyStatement({
      resources: ['*'],
      actions: [
        'ec2:DescribeInstances',
        'ec2:StartInstances',
        'ec2:StopInstances',
      ],
    }));
  }
}

// Lambda Stack
interface StackPropsLambda extends StackProps {
  lambdarole: IRole;
  env: Environment;
}

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props: StackPropsLambda) {
    super(scope, id, props);

    //////////////////////////////////
    // EC2 Auto Start
    //////////////////////////////////
    // Register Lambda Function
    const lambdaStart = new Function(this, 'LambdaFunctionAutoStart', {
      code: new InlineCode(readFileSync('lambda/lambda-ec2-start.py', { encoding: 'utf-8' })),
      handler: 'index.main',
      timeout: Duration.seconds(300),
      runtime: Runtime.PYTHON_3_6,
      role: props.lambdarole,
    });

    // CloudWatch Events
    const ruleStart = new Rule(this, 'EventRuleAutoStart', {
      schedule: Schedule.expression(this.node.tryGetContext('cron_start_ec2')),
    });
    ruleStart.addTarget(new LambdaFunction(lambdaStart));

    //////////////////////////////////
    // EC2 Auto Stop
    //////////////////////////////////
    // Register Lambda Function
    const lambdaStop = new Function(this, 'LambdaFunctionAutoStop', {
      code: new InlineCode(readFileSync('lambda/lambda-ec2-stop.py', { encoding: 'utf-8' })),
      handler: 'index.main',
      timeout: Duration.seconds(300),
      runtime: Runtime.PYTHON_3_6,
      role: props.lambdarole,
    });

    // CloudWatch Events
    const ruleStop = new Rule(this, 'EventRuleAutoStop', {
      schedule: Schedule.expression(this.node.tryGetContext('cron_stop_ec2')),
    });
    ruleStop.addTarget(new LambdaFunction(lambdaStop));
  }
}

// OS Environments
const osenv = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
};

// app
const app = new App();

// IAM Stack
const iamstack = new IamRoleStack(app, 'IamRoleStack', { env: osenv });

// Lambda Stack
new LambdaStack(app, 'LambdaStack', { lambdarole: iamstack.lambdarole, env: osenv });
