var async = require('async' ),
    request = require('request' ),
    _ = require('lodash' ),
    Agentkeepalive = require('agentkeepalive' ),
    ntlm = require('./lib/ntlm' );

var makeRequest = function(method, options, params, callback) {
  var KeepAliveOptions = {
        'Connection'        : 'Keep-Alive',
        'Proxy-Connection'  : 'Keep-Alive'
      },
      KeepAliveClass;

  if (options.url.toLowerCase().indexOf('https://') === 0) {
    KeepAliveClass = Agentkeepalive.HttpsAgent;
  } else {
    KeepAliveClass = Agentkeepalive;
  }

  options.agent = options.agent || new KeepAliveClass();

  if (!options.workstation) options.workstation = '';
  if (!options.ntlm_domain) options.ntlm_domain = '';
  if (!options.headers) options.headers = {};

  function startAuth($) {
    var type1msg = ntlm.createType1Message(options);
    options.method = method;
    _.extend( options.headers, KeepAliveOptions, {
      'Authorization'     : type1msg
    } );

    request(options, $);
  }

  function requestComplete(res, body, $) {
    if ( !res.headers['www-authenticate'] )
      return $(new Error('www-authenticate not found on response of second request'));

    var type2msg = ntlm.parseType2Message( res.headers['www-authenticate'], function ( err ) {
      if ( err ) {
        $( err, null );
      } else {
        var type3msg = ntlm.createType3Message( type2msg, options );
        options.method = method;
        _.extend( options.headers, KeepAliveOptions, {
          'Authorization'     : type3msg
        } );

        if (typeof body == "string")
          options.body = body;
        else
          options.json = body;

        request(options, $);
      }
    } );
  }

  async.waterfall([startAuth, requestComplete], callback);
};

exports.get = _.partial(makeRequest, 'get');
exports.post = _.partial(makeRequest, 'post');
exports.put = _.partial(makeRequest, 'put');
exports.delete = _.partial(makeRequest, 'delete');
