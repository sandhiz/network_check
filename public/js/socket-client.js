(function bootstrapSocketClient() {
  const socket = io();

  window.NetWatchSocket = {
    on(eventName, handler) {
      socket.on(eventName, handler);
    },
    off(eventName, handler) {
      socket.off(eventName, handler);
    },
    emit(eventName, payload) {
      socket.emit(eventName, payload);
    },
    getId() {
      return socket.id || null;
    },
    isConnected() {
      return socket.connected;
    },
    subscribeToHost(hostId) {
      socket.emit('subscribe:host', { hostId });
    },
    unsubscribeFromHost(hostId) {
      socket.emit('unsubscribe:host', { hostId });
    },
    triggerManualPing(hostId) {
      socket.emit('ping:manual', { hostId });
    }
  };
})();