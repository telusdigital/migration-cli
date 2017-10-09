'use strict';

const { expect } = require('chai');
const Bluebird = require('bluebird');

const migrationPlan = require('../../../../../../lib/migration-chunks');
const migrationSteps = require('../../../../../../lib/migration-steps');
const validatePlan = require('../../../../../../lib/migration-chunks/validation');

const stripCallsite = require('../../../../../helpers/strip-callsite');
const stripCallsites = (plan) => plan.map((chunk) => {
  chunk.steps = chunk.steps.map(stripCallsite);
  return chunk;
});

describe('field deletion plan validation', function () {
  describe('when creating a field two times but deleting it in between and then once more', function () {
    it('returns an error', Bluebird.coroutine(function * () {
      const steps = yield migrationSteps(function up (migration) {
        const person = migration.createContentType('person', {
          description: 'A content type for a person',
          name: 'foo'
        });

        person.createField('name').type('Symbol');
        person.deleteField('name');
        person.createField('name').type('Decimal');

        migration.createContentType('animal').name('animal').description('An animal');

        person.createField('name').type('Array');
      });

      const contentTypes = [];

      const plan = stripCallsites(migrationPlan(steps));
      const errors = validatePlan(plan, contentTypes);

      expect(errors).to.eql([
        {
          type: 'InvalidAction',
          message: 'Field with id "name" cannot be created more than once.',
          details: {
            step: {
              'type': 'field/create',
              'meta': {
                'contentTypeInstanceId': 'contentType/person/0',
                'fieldInstanceId': 'fields/name/3'
              },
              'payload': {
                'contentTypeId': 'person',
                'fieldId': 'name'
              }
            }
          }
        }
      ]);
    }));
  });

  describe('when creating a field two times but deleting it in between', function () {
    it('returns no errors', Bluebird.coroutine(function * () {
      const steps = yield migrationSteps(function up (migration) {
        const person = migration.createContentType('person', {
          description: 'A content type for a person',
          name: 'foo'
        });

        person.createField('name').type('Symbol');
        person.deleteField('name');
        person.createField('name').type('Decimal');
      });

      const contentTypes = [];

      const plan = stripCallsites(migrationPlan(steps));
      const errors = validatePlan(plan, contentTypes);

      expect(errors).to.eql([]);
    }));
  });

  describe('when deleting a field that does not exist', function () {
    it('returns an error', Bluebird.coroutine(function * () {
      const steps = yield migrationSteps(function up (migration) {
        const person = migration.createContentType('person', {
          description: 'A content type for a person',
          name: 'foo'
        });

        person.deleteField('name');
      });

      const contentTypes = [];

      const plan = stripCallsites(migrationPlan(steps));
      const errors = validatePlan(plan, contentTypes);

      expect(errors).to.eql([
        {
          type: 'InvalidAction',
          message: 'Field with id "name" cannot be deleted because it does not exist.',
          details: {
            step: {
              'type': 'field/delete',
              'meta': {
                'contentTypeInstanceId': 'contentType/person/0',
                'fieldInstanceId': 'fields/name/0'
              },
              'payload': {
                'contentTypeId': 'person',
                'fieldId': 'name'
              }
            }
          }
        }
      ]);
    }));
  });

  describe('when deleting a field twice', function () {
    it('returns an error', Bluebird.coroutine(function * () {
      const steps = yield migrationSteps(function up (migration) {
        const person = migration.createContentType('person', {
          description: 'A content type for a person',
          name: 'foo'
        });

        person.createField('name').type('Symbol');
        person.deleteField('name');

        migration.createContentType('chunk-breaker', {
          description: 'a chunk breaker',
          name: 'chunk breaker'
        });

        person.deleteField('name');
      });

      const contentTypes = [];

      const plan = stripCallsites(migrationPlan(steps));
      const errors = validatePlan(plan, contentTypes);

      expect(errors).to.eql([
        {
          type: 'InvalidAction',
          message: 'Field with id "name" cannot be deleted because it has already been deleted.',
          details: {
            step: {
              'type': 'field/delete',
              'meta': {
                'contentTypeInstanceId': 'contentType/person/0',
                'fieldInstanceId': 'fields/name/2'
              },
              'payload': {
                'contentTypeId': 'person',
                'fieldId': 'name'
              }
            }
          }
        }
      ]);
    }));
  });

  describe('when deleting a field that exists on a remote content type', function () {
    it('returns no error', Bluebird.coroutine(function * () {
      const steps = yield migrationSteps(function up (migration) {
        const person = migration.editContentType('person');

        person.deleteField('name');
      });

      const contentTypes = [{
        sys: { id: 'person' },
        fields: [
          { id: 'name', type: 'Symbol' }
        ]
      }];

      const plan = stripCallsites(migrationPlan(steps));
      const errors = validatePlan(plan, contentTypes);

      expect(errors).to.eql([]);
    }));
  });

  describe('when deleting a field on a content type that does not exist', function () {
    it('returns an error', Bluebird.coroutine(function * () {
      const steps = yield migrationSteps(function up (migration) {
        const person = migration.editContentType('person');

        person.deleteField('name');
      });

      const contentTypes = [];

      const plan = stripCallsites(migrationPlan(steps));
      const errors = validatePlan(plan, contentTypes);

      expect(errors).to.eql([
        {
          type: 'InvalidAction',
          message: 'You cannot delete the field with id "name" on content type "person" because it does not exist.',
          details: {
            step: {
              'type': 'field/delete',
              'meta': {
                'contentTypeInstanceId': 'contentType/person/0',
                'fieldInstanceId': 'fields/name/0'
              },
              'payload': {
                'contentTypeId': 'person',
                'fieldId': 'name'
              }
            }
          }
        }
      ]);
    }));
  });
});
