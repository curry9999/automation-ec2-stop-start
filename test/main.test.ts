import '@aws-cdk/assert/jest';
import { App } from '@aws-cdk/core';
import { IamRoleStack } from '../src/main';

test('Snapshot', () => {
  const app = new App();
  const stack = new IamRoleStack(app, 'test');

  expect(app.synth().getStackArtifact(stack.artifactId).template).toMatchSnapshot();
});