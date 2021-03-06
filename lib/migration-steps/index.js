'use strict';

const Bluebird = require('bluebird');
const DispatchProxy = require('./dispatch-proxy');
const actionCreators = require('./action-creators');

const getFirstExternalCaller = require('./first-external-caller');

const createInstanceIdManager = () => {
  const instanceCounts = {};

  return {
    getNew: (id) => {
      let instanceId;

      if ((typeof instanceCounts[id]) === 'undefined') {
        instanceId = 0;
      } else {
        instanceId = instanceCounts[id] + 1;
      }

      instanceCounts[id] = instanceId;

      return instanceId;
    }
  };
};

class Movement extends DispatchProxy {}

class Field extends DispatchProxy {
  constructor (id, props = {}, { dispatchUpdate }) {
    super({ dispatchUpdate });
    this.id = id;

    // Initialize from second argument
    Object.keys(props).forEach((propertyName) => {
      this[propertyName](props[propertyName]);
    });
  }
}

class ContentType extends DispatchProxy {
  constructor (id, instanceId, props = {}, dispatch) {
    const dispatchUpdate = (callsite, propertyName, propertyValue) => {
      dispatch(actionCreators.contentType.update(id, instanceId, callsite, propertyName, propertyValue));
    };
    super({ dispatchUpdate });

    this.id = id;
    this.instanceId = instanceId;
    this.dispatch = dispatch;
    this.fieldInstanceIds = createInstanceIdManager();

    // Initialize from pros
    Object.keys(props).forEach((propertyName) => {
      this[propertyName](props[propertyName]);
    });
  }

  createField (id, init) {
    const callsite = getFirstExternalCaller();
    const fieldInstanceId = this.fieldInstanceIds.getNew(id);

    this.dispatch(actionCreators.field.create(this.id, this.instanceId, id, fieldInstanceId, callsite));

    const updateField = actionCreators.field.update.bind(null, this.id, this.instanceId, id, fieldInstanceId);
    const field = new Field(id, init, {
      dispatchUpdate: (callsite, property, value) => {
        return this.dispatch(updateField(callsite, property, value));
      }
    });


    return field;
  }

  editField (id, init) {
    const fieldInstanceId = this.fieldInstanceIds.getNew(id);

    const updateField = actionCreators.field.update.bind(null, this.id, this.instanceId, id, fieldInstanceId);
    const field = new Field(id, init, {
      dispatchUpdate: (callsite, property, value) => {
        return this.dispatch(updateField(callsite, property, value));
      }
    });

    return field;
  }

  appendFieldValidation (id, init) {
    const fieldInstanceId = this.fieldInstanceIds.getNew(id);

    const updateField = actionCreators.field.appendValidation.bind(null, this.id, this.instanceId, id, fieldInstanceId);

    const field = new Field(id, init, {
      dispatchUpdate: (callsite, property, value) => {
        return this.dispatch(updateField(callsite, property, value));
      }
    });

    return field;
  }

  moveField (id) {
    const fieldInstanceId = this.fieldInstanceIds.getNew(id);

    const contentTypeId = this.id;
    const contentTypeInstanceId = this.instanceId;

    const movement = new Movement({
      dispatchUpdate: (callsite, property, value) => {
        const action = actionCreators.field.move(
          contentTypeId,
          contentTypeInstanceId,
          id,
          fieldInstanceId,
          callsite,
          { direction: property, pivot: value }
        );

        this.dispatch(action);
      }
    });

    return movement;
  }

  deleteField (id) {
    const callsite = getFirstExternalCaller();
    const fieldInstanceId = this.fieldInstanceIds.getNew(id);

    this.dispatch(actionCreators.field.delete(this.id, this.instanceId, id, fieldInstanceId, callsite));
  }

  changeFieldId (oldId, newId) {
    const callsite = getFirstExternalCaller();
    const fieldInstanceId = this.fieldInstanceIds.getNew(oldId);
    this.dispatch(actionCreators.field.rename(
      this.id,
      this.instanceId,
      oldId,
      fieldInstanceId,
      callsite,
      newId
    ));
  }
}

module.exports = Bluebird.coroutine(function * migration (migrationCreator) {
  const actions = [];
  const instanceIdManager = createInstanceIdManager();

  const dispatch = (action) => actions.push(action);

  const migration = {
    createContentType: function (id, init) {
      const callsite = getFirstExternalCaller();
      const instanceId = instanceIdManager.getNew(id);

      dispatch(actionCreators.contentType.create(id, instanceId, callsite));

      return new ContentType(id, instanceId, init, dispatch);
    },

    editContentType: function (id, changes) {
      const instanceId = instanceIdManager.getNew(id);

      const ct = new ContentType(id, instanceId, changes, dispatch);

      return ct;
    },

    deleteContentType: function (id) {
      const callsite = getFirstExternalCaller();
      const instanceId = instanceIdManager.getNew(id);
      dispatch(actionCreators.contentType.delete(id, instanceId, callsite));
    }
  };

  // Create the migration
  yield Bluebird.try(function () {
    return migrationCreator(migration);
  });

  return actions;
});
