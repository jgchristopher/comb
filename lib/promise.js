var hitch = require("./base/functions").hitch,
    define = require("./define").define, base = require("./base");

var Promise = define(null, {
    instance:{
        /** @lends comb.Promise.prototype */
        __fired:false,

        __results:null,

        __error:null,

        __errorCbs:null,

        __cbs:null,

        /**
         * Promise object used for handling a thread
         *@example
         *          var myFunc = function(){
         *              var promise = new Promise();
         *              //callback the promise after 10 Secs
         *              setTimeout(hitch(promise, "callback"), 10000);
         *              return promise;
         *          }
         *          var myFunc2 = function(){
         *              var promises =[];
         *              for(var i = 0; i < 10; i++){
         *                  promises.push(myFunc);
         *              }
         *              //create a new promise list with all 10 promises
         *              return new PromiseList(promises);
         *          }
         *
         *          myFunc.then(do something...)
         *          myFunc.addCallback(do something...)
         *          myFunc.chain(myfunc).then(do something...)
         *          myFunc.chain(myfunc).addCallback(do something...)
         *
         *          myFunc2.then(do something...)
         *          myFunc2.addCallback(do something...)
         *          myFunc2.chain(myfunc).then(do something...)
         *          myFunc2.chain(myfunc).addCallback(do something...)
         *  @memberOf comb
         * @constructs
         */
        constructor:function () {
            this.__errorCbs = [];
            this.__cbs = [];
        },
        /**
         * @private
         */
        __resolve:function () {
            if (!this.__fired) {
                this.__fired = true;
                var cbs = this.__error ? this.__errorCbs : this.__cbs,
                    len = cbs.length, i,
                    results = this.__error || this.__results;
                for (i = 0; i < len; i++) {
                    this.__callNextTick(cbs[i], results);
                }
            }
        },

        __callNextTick:function (cb, results) {
            process.nextTick(hitch(this, function () {
                cb.apply(this, results);
            }));
        },

        /**
         * Add a callback to the callback chain of the promise
         *
         *
         * @param {Function|comb.Promise} cb the function or promise to callback when the promise is resolved.
         *
         * @return {comb.Promise} this promise for chaining
         */
        addCallback:function (cb) {
            if (cb) {
                if (exports.isPromiseLike(cb)) {
                    cb = hitch(cb, "callback");
                }
                if (this.__fired && this.__results) {
                    cb.apply(this, this.__results);
                } else {
                    this.__cbs.push(cb);
                }
            }
            return this;
        },


        /**
         * Add a callback to the errback chain of the promise
         *
         * @param {Function|comb.Promise} cb the function or promise to callback when the promise errors
         *
         * @return {comb.Promise} this promise for chaining
         */
        addErrback:function (cb) {
            if (cb) {
                if (exports.isPromiseLike(cb)) {
                    cb = hitch(cb, "errback");
                }
                if (this.__fired && this.__error) {
                    cb.apply(this, this.__error);
                } else {
                    this.__errorCbs.push(cb);
                }
            }
            return this;
        },

        /**
         *
         * Adds a callback or promise to be resolved for both success
         * and error.
         *
         * @param {Function|comb.Promise} cb callback or promise to be resolved for both success
         * and error.
         * @return {comb.Promise} this promise for chaining
         */
        both:function (cb) {
            this.addCallback(cb);
            if (exports.isPromiseLike(cb)) {
                this.addErrback(hitch(cb, "callback"));
            } else {
                this.addErrback(cb);
            }

            return this;
        },

        /**
         * When called all functions registered as callbacks are called with the passed in results.
         *
         * @param {*} args variable number of results to pass back to listeners of the promise
         */
        callback:function (args) {
            args = base.argsToArray(arguments);
            if (this.__fired) {
                throw new Error("Already fired!");
            }
            this.__results = args;
            this.__resolve();
            return this;
        },


        /**
         * When called all functions registered as errbacks are called with the passed in error(s)
         *
         * @param {*} args  number of errors to pass back to listeners of the promise
         */
        errback:function (args) {
            if (this.__fired) {
                throw args || new Error("Already fired");
            }
            this.__error = base.argsToArray(arguments);
            this.__resolve();
            return this;
        },

        /**
         * Call to specify action to take after promise completes or errors
         *
         * @param {Function} [callback=null] function to call after the promise completes successfully
         * @param {Function} [errback=null] function to call if the promise errors
         *
         * @return {comb.Promise} this promise for chaining
         */
        then:function (callback, errback) {
            if (exports.isPromiseLike(callback)) {
                this.addCallback(callback);
                this.addErrback(callback);
            } else {
                this.addCallback(callback);
                this.addErrback(errback);
            }
            return this;
        },

        /**
         * Call this function as a classic node callback where the first argument
         * will be an error, or null if no error occured. The other arugments will
         * be the result from the promise.
         *
         * @example
         *
         * promise.classic(function(err, res){
         *      if(err){
         *          console.log(err);
         *      }else{
         *          console.log(res);
         *      }
         * });
         *
         * @param cb callback where the first argument
         * will be an error, or null if no error occured. The other arugments will
         * be the result from the promise.
         * @return {comb.Promise} the promise to chain
         */
        classic:function (cb) {
            if ("function" === typeof cb) {
                this.addErrback(function (err) {
                    cb(err);
                });
                this.addCallback(function () {
                    cb.apply(this, [null].concat(base.argsToArray(arguments)));
                });
            }
            return this;
        },

        /**
         * Call to chaining of promises
         * @param callback method to call that returns a promise to call after this one completes.
         * @param errback method to call if this promise errors.
         *
         * @return {comb.Promise} A new that wraps the promise for chaining
         */
        chain:function (callback, errback) {
            var promise = new Promise();
            this.addCallback(function (results) {
                callback.call(this, results).then(promise);
            });
            this.addErrback(errback);
            return promise;
        },

        /**
         * Applies the same function that returns a promise to both the callback and errback.
         *
         * @param {Function} callback function to call. This function must return a Promise
         *
         * @return {comb.Promise} a promise to continue chaining or to resolve with.
         *
         */
        chainBoth:function (callback) {
            var p = this.chain(callback);
            this.addErrback(function (results) {
                callback.call(this, results).then(p);
            });
            return p;
        }


    }
});


var PromiseList = define(Promise, {
    instance:{
        /** @lends comb.PromiseList.prototype */

        /*@private*/
        __results:null,

        /*@private*/
        __errors:null,

        /*@private*/
        __promiseLength:0,

        /*@private*/
        __defLength:0,

        /*@private*/
        __firedLength:0,

        normalizeResults:false,

        /**
         *
         *  PromiseList object used for handling a list of Promises
         * @example         var myFunc = function(){
         *              var promise = new Promise();
         *              //callback the promise after 10 Secs
         *              setTimeout(hitch(promise, "callback"), 10000);
         *              return promise;
         *          }
         *          var myFunc2 = function(){
         *              var promises =[];
         *              for(var i = 0; i < 10; i++){
         *                  promises.push(myFunc);
         *              }
         *              //create a new promise list with all 10 promises
         *              return new PromiseList(promises);
         *          }
         *          var pl = new comb.PromiseList([myFunc(), myFunc2()]);
         *          pl.then(do something...)
         *          pl.addCallback(do something...)
         *          pl.chain(myfunc).then(do something...)
         *          pl.chain(myfunc).addCallback(do something...)
         *
         *  @param {comb.Promise[]} [defs=[]] the list of promises
         * @constructs
         * @augments comb.Promise
         * @memberOf comb
         * */
        constructor:function (defs, normalizeResults) {
            this.__errors = [];
            this.__results = [];
            this.normalizeResults = base.isBoolean(normalizeResults) ? normalizeResults : false;
            this._super(arguments);
            if (defs && defs.length) {
                this.__defLength = defs.length;
                defs.forEach(this.__addPromise, this);
            } else {
                this.__resolve();
            }
        },

        /**
         * Add a promise to our chain
         * @private
         * @param promise the promise to add to our chain
         * @param i the index of the promise in our chain
         */
        __addPromise:function (promise, i) {
            promise.addCallback(hitch(this, function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(i);
                this.callback.apply(this, args);
            }));
            promise.addErrback(hitch(this, function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(i);
                this.errback.apply(this, args);
            }));
        },

        /**
         * Resolves the promise
         * @private
         */
        __resolve:function () {
            if (!this.__fired) {
                this.__fired = true;
                var cbs = this.__errors.length ? this.__errorCbs : this.__cbs,
                    len = cbs.length, i,
                    results = this.__errors.length ? this.__errors : this.__results;
                for (i = 0; i < len; i++) {
                    this.__callNextTick(cbs[i], results);
                }
            }
        },

        __callNextTick:function (cb, results) {
            process.nextTick(hitch(this, function () {
                cb.apply(this, [results]);
            }));
        },

        addCallback:function (cb) {
            if (cb) {
                if (exports.isPromiseLike(cb)) {
                    cb = hitch(cb, "callback");
                }
                if (this.__fired && !this.__errors.length) {
                    cb.call(this, this.__results);
                } else {
                    this.__cbs.push(cb);
                }
            }
            return this;
        },

        addErrback:function (cb) {
            if (cb) {
                if (exports.isPromiseLike(cb)) {
                    cb = hitch(cb, "errback");
                }
                if (this.__fired && this.__errors.length) {
                    cb.call(this, this.__errors);
                } else {
                    this.__errorCbs.push(cb);
                }
            }
            return this;
        },


        callback:function (i) {
            if (this.__fired) {
                throw new Error("Already fired!");
            }
            var args = base.argsToArray(arguments);
            if (this.normalizeResults) {
                args = args.slice(1);
                args = args.length == 1 ? args.pop() : args;
            }
            this.__results[i] = args;
            this.__firedLength++;
            if (this.__firedLength == this.__defLength) {
                this.__resolve();
            }
            return this;
        },


        errback:function (i) {
            if (this.__fired) {
                throw new Error("Already fired!");
            }
            var args = base.argsToArray(arguments);
            if (this.normalizeResults) {
                args = args.slice(1);
                args = args.length == 1 ? args.pop() : args;
            }
            this.__errors[i] = args;
            this.__firedLength++;
            if (this.__firedLength == this.__defLength) {
                this.__resolve();
            }
            return this;
        }

    }
});
exports.Promise = Promise;
exports.PromiseList = PromiseList;




base.merge(exports, {
    /**
     * @lends comb
     */

    /**
     * Tests if an object is like a promise (i.e. it contains then, addCallback, addErrback)
     * @param obj object to test
     */
    isPromiseLike:function (obj) {
        return !base.isUndefinedOrNull(obj) && (base.isInstanceOf(obj, Promise) || (base.isFunction(obj.then)
            && base.isFunction(obj.addCallback) && base.isFunction(obj.addErrback)));
    },

    /**
     * Waits for promise and non promise values to resolve and fires callback or errback appropriately.
     *
     * @example
     *  var a = "hello";
     *  var b = new comb.Promise().callback(world);
     *  comb.when(a, b) => called back with ["hello", "world"];
     *
     * @param {Anything...} args variable number of arguments to wait for
     * @param {Function} cb the callback function
     * @param {Function} eb the errback function
     * @returns {comb.Promise} a promise that is fired when all values have resolved
     */
    when:function (args, cb, eb) {
        var args = base.argsToArray(arguments), p;
        eb = base.isFunction(args[args.length - 1]) ? args.pop() : null;
        cb = base.isFunction(args[args.length - 1]) ? args.pop() : null;
        if (eb && !cb) {
            cb = eb;
            eb = null;
        }
        if (!args.length) {
            p = new Promise().callback(args);
        } else if (args.length == 1) {
            args = args.pop();
            p = exports.isPromiseLike(args) ? args : new Promise().callback(args);
        } else {
            var p = new PromiseList(args.map(function (a) {
                return exports.isPromiseLike(a) ? a : new Promise().callback(a);
            }), true);
        }
        if (cb) {
            p.addCallback(cb);
        }
        if (eb) {
            p.addErrback(eb);
        }
        return p;

    },

    /**
     * Wraps traditional node style functions with a promise.
     * @example
     *
     * var fs = require("fs");
     * var readFile = comb.wrap(fs.readFile, fs);
     * readFile(__dirname + "/test.json").then(
     *      function(buffer){
     *          console.log(contents);
     *      },
     *      funciton(err){
     *
     *      }  console.error(err);
     * );
     *
     *
     * @param {Function} fn function to wrap
     * @param {Object} scope scope to call the function in
     *
     * @return {Funciton} a wrapped function
     */
    wrap:function (fn, scope) {
        return function () {
            var ret = new Promise();
            var args = base.argsToArray(arguments);
            args.push(function (err, res) {
                var args = base.argsToArray(arguments);
                if (err) {
                    ret.errback(err);
                } else {
                    args.shift();
                    ret.callback.apply(ret, args);
                }
            });
            fn.apply(scope || this, args);
            return ret;
        }
    },

    /**
     * Executes a list of items in a serial manner. If the list contains promises then each promise
     * will be executed in a serial manner, if the list contains non async items then the next item in the list
     * is called.
     *
     * @example
     *
     * var asyncAction = function(item, timeout){
     *    var ret = new comb.Promise();
     *    setTimeout(comb.hitchIgnore(ret, "callback", item), timeout);
     *    return ret;
     * };
     *
     * comb.serial([
     *     comb.partial(asyncAction, 1, 1000),
     *     comb.partial(asyncAction, 2, 900),
     *     comb.partial(asyncAction, 3, 800),
     *     comb.partial(asyncAction, 4, 700),
     *     comb.partial(asyncAction, 5, 600),
     *     comb.partial(asyncAction, 6, 500)
     * ]).then(function(results){
     *     console.log(results); // [1,2,3,4,5,6];
     * });
     *
     *
     *
     * @param list
     * @param callback
     * @param errback
     */
    serial:function (list, callback, errback) {
        var ret = new Promise();
        if (base.isArray(list)) {
            callNext(list, 0, [], false, ret)
        } else {
            throw new Error("When calling comb.serial the first argument must be an array");
        }
        ret.then(callback, errback);
        return ret;
    }

});

var when = exports.when;


var callNextSuccess = function (list, index, results, isErrored, ret) {
    //store results
    var args = base.argsToArray(arguments).slice(5);
    results.push(args.length == 1 ? args[0] : args);
    process.nextTick(base.partial(callNext, list, index + 1, results, isErrored, ret));
};

var callNextError = function (index, results, isErrored, ret) {
    //store results
    var args = base.argsToArray(arguments).slice(4);
    ret.errback.apply(ret, args);
};

var callNext = function (list, index, results, isErrored, ret) {
    if (index < list.length) {
        var item = list[index];
        try {
            when(base.isFunction(item) ? item() : item,
                base.partial(callNextSuccess, list, index, results, isErrored, ret),
                base.partial(callNextError, index, results, isErrored, ret));
        } catch (e) {
            ret.errback(e);

        }
    } else {
        ret.callback(results);
    }
};

