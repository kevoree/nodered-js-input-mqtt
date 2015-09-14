var AbstractComponent = require('kevoree-entities').AbstractComponent;
var mqtt = require('mqtt');
var crypto = require('crypto');
var noderedMsgConverter = require('nodered-msg-converter');

/**
 * Kevoree component
 * @type {MQTTIn}
 */
var MQTTIn = AbstractComponent.extend({
  toString: 'MQTTIn',

  dic_broker: {
    optional: false
  },
  dic_port: {
    optional: false,
    datatype: 'number'
  },
  dic_topic: {
    optional: true
  },
  dic_clientID: {},
  dic_username: {},
  dic_password: {},

  construct: function() {
    this.client = null;
    this.connected = false;
    this.watchdog = null;
  },

  /**
   * this method will be called by the Kevoree platform when your component has to start
   * @param {Function} done
   */
  start: function(done) {
    var that = this;

    var options = {
      host: this.dictionary.getString('broker'),
      port: this.dictionary.getNumber('port'),
      clientId: this.dictionary.getString('clientId', crypto.randomBytes(16).toString('hex')),
      username: this.dictionary.getString('username'),
      password: this.dictionary.getString('password')
    };
    that.log.info(that.toString(), '"'+that.getName()+'" trying to connect to tcp://'+options.host+':'+options.port + ' ...');
    this.client = mqtt.connect(options);

    this.client.on('connect', function () {
      that.connected = true;
      that.log.info(that.toString(), '"'+that.getName()+'" connected to tcp://'+options.host+':'+options.port);
      var topic = that.dictionary.getString('topic');
      that.client.subscribe(topic);
      that.log.info(that.toString(), '"'+that.getName()+'" made a subscription to '+topic);
      that.client.on('message', function (topic, data, info) {
        var msg = noderedMsgConverter(data.toString('utf-8'));
        if (!msg._msgid) {
          msg._msgid = (1+Math.random()*4294967295).toString(16);
        }
        msg.topic = info.topic;
        msg.retain = info.retain;
        msg.qos = info.qos;
        that.out_out(JSON.stringify(msg));
      });
    });

    this.client.on('close', function () {
      that.connected = false;
    });

    clearInterval(this.watchdog);
    this.watchdog = setInterval(function () {
      if (!that.connected) {
        that.log.info(that.toString(), '"'+that.getName()+'" unable to connect to tcp://'+options.host+':'+options.port);
      }
    }, 15000);

    done();
  },

  /**
   * this method will be called by the Kevoree platform when your component has to stop
   * @param {Function} done
   */
  stop: function(done) {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    clearInterval(this.watchdog);
    this.connected = false;
    this.watchdog = null;
    done();
  },

  update: function(done) {
    this.stop(function() {
      this.start(done);
    }.bind(this));
  },

  out_out: function(msg) {}
});

module.exports = MQTTIn;
