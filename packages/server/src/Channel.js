import { PKT_ACTION, PKT_EVENT } from 'shocked-common';

class Channel {
  constructor(id) {
    this.id = id;
  }

  dispatch(action) {
    return Channel.provider.publish(this.id, PKT_ACTION(action));
  }

  emit(event, data) {
    return Channel.provider.publish(this.id, PKT_EVENT(event, data));
  }

  subscribe(session) {
    return Channel.provider.subscribe(this.id, session);
  }

  unsubscribe(session) {
    return Channel.provider.unsubscribe(this.id, session);
  }

  toString() {
    return this.id;
  }
}

Channel.subscribe = (id, session) => Channel.provider.subscribe(id, session);

Channel.unsubscribe = (id, session) => Channel.provider.unsubscribe(id, session);

Channel.setProvider = (provider) => {
  Channel.provider = provider;
};

Channel.get = id => new Channel(id);

export default Channel;
