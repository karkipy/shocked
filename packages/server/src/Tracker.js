const {
  PKT_TRACKER_ACTION,
  PKT_TRACKER_EMIT,
  PKT_TRACKER_OPEN,
  PKT_TRACKER_CLOSE,
  PKT_TRACKER_TIMESTAMP,
  initTracker,
  batchActions,
} = require('shocked-common');

class Tracker {
  constructor(id, session, params, serial) {
    this.id = id;
    this.session = session;

    if (this.onCreate) {
      this.onCreate(params);
    }

    this.channel = this.getChannel();

    this.onAction = this.onAction.bind(this);

    // TODO: Handle the error that can occur during subscription
    // Most likely send an event
    Promise.resolve(this.channel.subscribe(this.onAction, serial))
      .then((token) => {
        if (token) {
          return this.getInitialData().then((initialData) => {
            this.onAction(initTracker(initialData), token);
          });
        }
        return null;
      })
      .then(() => {
        if (this.isOpen()) {
          if (this.onOpen) {
            this.onOpen();
          }
          this.session.send(PKT_TRACKER_OPEN(this.id));
        }
      })
      .catch((err) => {
        this.emit('error', { message: err.message });
      });
  }

  isOpen() {
    return this.channel !== null;
  }

  async getChannel() {
    throw new Error(`The tracker ${this.constructor.name} must implement getChannel().`);
  }

  async getInitialData() {
    throw new Error(`The tracker ${this.constructor.name} must implement getInitialData().`);
  }

  onAction(action, serial) {
    if (this.isOpen()) {
      // Convert array action into batch
      const actionToDispatch = Array.isArray(action) ? batchActions(action) : action;
      this.session.send(PKT_TRACKER_ACTION(this.id, actionToDispatch, serial));
    }
  }

  close(code, message) {
    if (this.isOpen()) {
      this.session.send(PKT_TRACKER_CLOSE(this.id, code, message));
      if (this.onClose) {
        this.onClose();
      }

      this.channel.unsubscribe(this.onAction);
      this.channel = null;
    }
  }

  emit(event, data) {
    if (this.isOpen()) {
      this.session.send(PKT_TRACKER_EMIT(this.id, event, data));
    }
  }

  dispatch(action) {
    if (this.isOpen()) {
      this.channel.publish(action);
    }
  }

  // Used for calculating the latency
  getClientTimestamp() {
    if (process.env.NODE_ENV === 'development') {
      if (!this.updateTimestamp) {
        throw new Error(`${this.constructor.name} doesn't define updateTimestamp but is calling getClientTimestamp.`);
      }
    }
    if (this.isOpen()) {
      this.session.send(PKT_TRACKER_TIMESTAMP(this.id, Date.now()));
    }
  }
}

module.exports = Tracker;
