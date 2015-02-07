/**
 * IDPF Component Protocol Package
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Inkling/IDPF
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * This is all very prototype code:
 * TODO:
 *     1. [fixed] This code broadcasts to all components in the hierarchy,
 *        we need to revisit strategies to optimize this.
 *     2. [fixed] Encapsulate code
 *     3. [~fixed]Clean up signatures
 *     4. Get naming right
 *     5. Determine if we have timing issues
 */


(function () {

    var typeOfMessage_ = "epubsc_message";

    // Methods
    var methodSubscribeStr_ = "epubsc_subscribe";
    var methodUnsubscribeStr_ = "epubsc_unsubscribe";
    var methodPublishStr_ = "epubsc_publish";
    var methodReadyStr_ = "epubsc_ready";

    // Resevered topics
    var topicReady_ = topicReady_ ? topicReady_ : "epubsc_ready";
    var topicPause_ = topicPause_ ? topicPause_ : "epubsc_pause";
    var topicResume_ = topicResume_ ? topicResume_ : "epubsc_resume";

    //<editor-fold desc="DEBUGGING">
    /* TODO: fix */
    var DEBUG_ = (document.URL.slice(document.URL.indexOf("?") + 1).indexOf("DEBUG") > -1);

    /**
     * Turn console.log spew on or off.
     * @type {boolean}
     * @private
     */
    var verbose_ = true;

    /**
     * Assertion testing function.
     * @param {boolean} bool - value of assertion.
     * @param {string} msg to show on failed assertion.
     */
    function assert_(bool, msg) {
        if (!bool)
        {
            if (DEBUG_)
            {
                window.console.warn("AssertionFailure: " + msg);
                debugger;
            }
            else
            {
                alert("AssertionFailure: " + msg);
            }
        }
    }

    /**
     * Message counter.
     * @type {number}
     */
    var counter_ = 0;

    /* end debugging stuff */
    //</editor-fold>

    //<editor-fold desc="IDness">
    /**
     * @return {string} a uuid.
     */
    function generateUUID_() {
        var d = new Date().getTime();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == "x" ? r : (r & 0x7 | 0x8)).toString(16);
        });
    }

    /**
     * ID of component
     * @type {string} guid -.
     * @private
     */
    var componentID_ = generateUUID_();
    window.componentID_ = componentID_;

    //</editor-fold>


    //<editor-fold desc="Topic Message">

    /**
     * The object used to pass topics between components/windows.
     * @param {string} method -.
     * @param {string} topicName -.
     * @param {(Object | string)=} opt_data topic data.
     * @constructor
     */
    var TopicMessage_ = function (method, topicName, opt_data) {
        this.init(method, topicName, opt_data);
    };


    /**
     * @param {string} method -.
     * @param {string} topicName -.
     * @param {(Object | string)=} opt_data
     */
    TopicMessage_.prototype.init = function (method, topicName, opt_data) {

        /* start of spec related properties */
        this.componentId = componentID_;
        this.messageId = generateUUID_();
        this.timestamp = +new Date();

        this.type = typeOfMessage_;

        this.method = method;

        this.topic = topicName;
        this.topicData = opt_data;
        /* end of spec related properties */

        /* start of implementation properties */
        if (DEBUG_)
        {
            //noinspection JSUnusedGlobalSymbols
            this.counter_ = ++counter_;
        }
        /* end of implelementation properities */
    };
    //</editor-fold>


    //<editor-fold desc="Child Windows">
    /**
     * List of child windows, used to determine the dispatcinging of messages.
     * @type {Array}
     * @private
     */
    var childWindows_ = [];

    function addChildWindow(childWin) {
        if (childWindows_.indexOf(childWin) < 0)
        {
            childWindows_.push(childWin);
        }
    }

    function isChildWindow(win) {
        return childWindows_.indexOf(win) >= 0;
    }

    //</editor-fold>


    //<editor-fold desc="Topic Dictionary & Dictionary Entry">
    /**
     *
     * @type {{}}
     * @private
     */
    var TopicMap_ = {};


    /**
     * @param {string} topicName -.
     * Constructor for topic handler.
     * @constructor
     */
    var TopicEntry_ = function (topicName) {
        /**
         * array of iframe windows, these are windows
         * that we dispatch topics to.
         * Each subscriber in this array must be unique (e.g. we do
         * not dispatch a topic to a window twice.
         * @type {Window}
         */
        this.subscribers_ = [];

        /**
         * array of functions
         * these are local functions that implement a topic.
         * Multiple handlers must be allowed.
         * (e.g. componentSrc.subscribe("topic", function (msg) {
         *     code
         * });
         * componentSrc.subscribe("topic", function (msg) {
         *      different code
         * });
         * @type {function}
         */
        this.handlers_ = [];

        this.topic_ = topicName;
    };

    /**
     * @param {function} f new handler.
     */
    TopicEntry_.prototype.addHandler = function (f) {
        this.handlers_.push(f);
    };


    /**
     * Remove the function handler from this topic
     * @param {function} f new handler.
     */
    TopicEntry_.prototype.removeHandler = function (f) {
        var i = this.handlers_.indexOf(f);
        if (i >= 0)
        {
            this.handlers_.splice(i, 1);
        }
    };


    /**
     * @param {TopicMessage_} message to publish.
     */
    TopicEntry_.prototype.callHandlers = function (message) {
        for (var i = 0; i < this.handlers_.length; i++)
        {
            if (message.componentId != componentID_)
            {
                this.handlers_[i](message.topicData);
            }
        }
    };

    /**
     * @param {TopicMessage_} message to publish.
     */
    TopicEntry_.prototype.callHandlers2 = function (message) {
        for (var i = 0; i < this.handlers_.length; i++)
        {
            if (message.componentId != componentID_)
            {
                this.handlers_[i](message);
            }
        }
    };

    /**
     * Does the TopicHandler have any handlers
     * @return {boolean}
     */
    TopicEntry_.prototype.anyHandlers = function () {
        return this.handlers_.length > 0;
    };

    var epubsc_window_id = 1000;

    //noinspection JSUnusedLocalSymbols
    /**
     * Add a child window as a subscriber to this topic.
     * @param {Window} win subscriber.
     * @param {string} componentid -.
     */
    TopicEntry_.prototype.addSubscriber = function (win, componentid) {
        /**
         * The window can only exist in the current windows context,
         * so no need to protect against duplicate subscribers,
         * which happens when a child and a grandchild subscribe
         * to the same topic
         */

        if (this.subscribers_.indexOf(win) < 0)
        {
            this.subscribers_.push(win);
            addChildWindow(win);
        }

        window.console.log(document.URL + " - " + this.topic_ + "  addSubscriber: Subscriber count: " + this.subscriberCount());
    };


    /**
     * Remove the child window as a subscriber to this topic.
     * @param {Window} win subscriber.
     */
    TopicEntry_.prototype.removeSubscriber = function (win) {
        // Find and remove item from an array
        var i = this.subscribers_.indexOf(win);
        if (i >= 0)
        {
            this.subscribers_.splice(i, 1);
            /* we never remove child windows */
        }
        window.console.log(document.URL + " - " + this.topic_ + "  removeSubscriber: Subscriber count: " + this.subscriberCount());
    };


    /**
     * Call all my subscribers
     * @param {TopicMessage_} message -.
     * @param {Window} srcWin -.
     */
    TopicEntry_.prototype.callSubscribers = function (message, srcWin) {
        for (var i = 0; i < this.subscribers_.length; i++)
        {
            /* TODO: security implications of star? */
            if (srcWin !== this.subscribers_[i])
            {
                this.subscribers_[i].postMessage(message, "*");
            }
        }
    };


    /**
     * Does the TopicHandler have any subscribers
     * @return {boolean}
     */
    TopicEntry_.prototype.anySubscribers = function () {
        return this.subscribers_.length > 0;
    };

    /**
     * Number of subscribers
     * @return {number}
     */
    TopicEntry_.prototype.subscriberCount = function () {
        return this.subscribers_.length;
    };
    //</editor-fold>

    //<editor-fold desc="Internal implementation">
    /**
     * Publish a message topic to only my ancestors.
     * @param {string} topicName
     * @param {*} data to publish.
     */
    function publishToParent_(topicName, data) {
        var message = new TopicMessage_(methodReadyStr_, topicName, data);
        publish_(topicName, message, window, true);
    }


    //noinspection JSUnusedLocalSymbols
    /**
     * Publish a message topic.
     * @param {string} topicName topic string.
     * @param {TopicMessage_} message to publish.
     * @param {Window} srcWin -.
     * @param {boolean} bubbleonly send only to parent.
     * @private
     */
    function publish_(topicName, message, srcWin, bubbleonly) {
        var topic = TopicMap_[topicName];

        if (topic)
        {
            topic.callHandlers(message);

            if (!bubbleonly)
            {
                /* walk back down the tree */
                topic.callSubscribers(message, srcWin);
            }
        }

        if (srcWin != window.parent && window != window.parent)
        {
            window.parent.postMessage(message, "*");
        }
    }


    /**
     * Returns array of all DOM level events subscribed to.
     * @returns {Array}
     * @private
     */
    function subscribedEvents_() {
        var subscribedEvents = [];

        for (var key in TopicMap_)
        {
            if (TopicMap_.hasOwnProperty(key) && publishableBrowserEvents_.indexOf(key) > -1)
            {
                subscribedEvents.push(key);
            }
        }
        return subscribedEvents;
    }

    /**
     * TODO: is this debug only?
     * Returns an array of non system subscriptions
     * @returns {Array}
     */
    function subscribedTopics_() {
        /* There are a few subscriptions are all components
         * subscribe to at startup, so no need to broadcast
         * these, we will remove.
         */
        var sysLevelSubscriptions = [topicReady_, "sysShutdown", "sysEventSubscribe", "sysEventUnsubscribe"];

        var subscriptions = [];

        for (var key in TopicMap_)
        {
            if (TopicMap_.hasOwnProperty(key))
            {
                if (sysLevelSubscriptions.indexOf(key) < 0)
                {
                    subscriptions.push(key);
                }
            }
        }
        return subscriptions;
    }

    //</editor-fold>

    //<editor-fold desc="Events">

    /**
     * A generic browser event object, suitable for publishing across frame
     * boundaries.
     * @param {Event=} opt_event An event to clone.
     * @constructor
     */
    var BrowserEvent = function (opt_event) {
        if (opt_event)
        {
            this.init(opt_event);
        }
    };


    /**
     * TODO: this schema must be documented in public spec.
     * Initialize a BrowserEvent object that conforms to [insert spec ref here].
     * The new object is suitable for use in publishing events in ESC. Note
     * that, per the spec, parameters that reference elements (for example,
     * e.target or e.srcElement) are not copied.
     * @param {!Event} e
     */
    BrowserEvent.prototype.init = function (e) {
        /* TODO: Decide if assigning undefined properties is bad. It means that
         *this.hasOwnProperty(X) will be true even if e.hasOwnProperty(X) is
         * false.
         */
        this.type = e.type;
        this.screenX = e.screenX;
        this.screenY = e.screenY;
        this.button = e.button;

        this.keyCode = e.keyCode;
        this.charCode = e.charCode;
        this.ctrlKey = e.ctrlKey;
        this.altKey = e.altKey;
        this.shiftKey = e.shiftKey;
        this.metaKey = e.metaKey;

        /* TODO: Test this. */
        if (e.touches)
        {
            /* TODO: Decide if we want to rely on Array.prototype.map. If not,
             * we should provide an implementation.
             */
            this.touches = e.touches.map(function (coord) {
                return {screenX: coord.screenX, screenY: coord.screenY};
            });
        }

        this.state = e.state;
        this.defaultPrevented = e.defaultPrevented;
    };

    /**
     * Dictionary of published events.
     * @type {{}}
     * @private
     */
    var eventPublishDictionary_ = {};

    /**
     * An array of all publishable events.
     * TODO: Consider a set, then we can test event types to make sure they
     * should be propagated.
     * @type {Array.<string>}
     */
    var publishableBrowserEvents_ = [
        "click", "dblclick", "mousedown", "mouseup", "mousemove",
        "keydown", "keypress", "keyup",
        "touchstart", "touchend", "touchmove", "touchcancel",
        "pointerdown", "pointerup", "pointercancel", "pointermove"
    ];

    /**
     * TODO: Consider poly-fill for forEach.
     */
    publishableBrowserEvents_.forEach(function (eventName) {
        eventPublishDictionary_[eventName] = {
            active: false,
            publish: function (e) {
                wapi.publish(eventName, new BrowserEvent(e));
            }
        }
    });
    //</editor-fold>

    //<editor-fold desc="Public API">
    var wapi = {
        componentID: componentID_
    };

    /**
     * Subscribe to a topic
     * @param {string} topicName name of topic.
     * @param {function} func to handle topic messages.
     */
    wapi.subscribe = function (topicName, func) {

        if (!TopicMap_[topicName])
        {
            TopicMap_[topicName] = new TopicEntry_(topicName);
        }
        TopicMap_[topicName].addHandler(func);

        /* Tell parent I am subscribing to topic. */
        if (window.parent != window)
        {
            window.parent.postMessage(new TopicMessage_(methodSubscribeStr_, topicName), "*");
        }
    };

    /**
     * Unsubscribe from a topic
     * @param {string} topicName
     * @param {function} func to remove.
     */
    wapi.unsubscribe = function (topicName, func) {
        if (TopicMap_[topicName])
        {
            var topic = TopicMap_[topicName];
            topic.removeHandler(func);

            if (!topic.anyHandlers() && !topic.anySubscribers())
            {
                window.parent.postMessage(new TopicMessage_(methodUnsubscribeStr_, topicName), "*");
                delete TopicMap_[topicName];
            }
        }
    };


    /**
     * Publish a message topic.
     * @param {string} topicName
     * @param {*} data to publish.
     */
    wapi.publish = function (topicName, data) {
        publish_(topicName, new TopicMessage_(methodPublishStr_, topicName, data), window, false);
    };

    /**
     * Send a message topic to a specific iframe.
     * @param {Window} win -.
     * @param {string} topicName -.
     * @param {*} data to publish.
     */
    wapi.send = function (win, topicName, data) {
        var message = new TopicMessage_(methodPublishStr_, topicName, data);
        win.postMessage(message, "*");
    };

    //</editor-fold>

    //<editor-fold desc="Subscriptions">
    /**
     * Startup
     * Publish events to components that are now ready.
     */
    wapi.subscribe(topicReady_, function (msg) {
        if (DEBUG_ && verbose_)
        {
            window.console.log(window.document.URL + "-" + componentID_ + "   received ready: ");
        }
        /* end provisional, may not need it */

        /* tell the recently loaded component (and all others) what events
         * it should publish
         */
        var events = subscribedEvents_();
        if (events.length)
        {
            wapi.publish("sysEventSubscribe", events);
        }
    });

    /**
     * Shutdown - is
     */
    wapi.subscribe("sysShutdown", function (msg) {
        if (DEBUG_ && verbose_)
        {
            window.console.log("sysShutdown: " + msg);
        }
    });

    /**
     *
     */
    wapi.subscribe("sysEventSubscribe", function (msg) {

        /**
         * Adds listener for events and then propagates those events
         * to the parent window
         * @param {Array.<string>} events to propagate.
         */
        function publishEvents(events) {
            for (var i = 0; i < events.length; i++)
            {
                var key = events[i];
                if (eventPublishDictionary_[key])
                {
                    if (!eventPublishDictionary_[key].active)
                    {
                        window.addEventListener(key, eventPublishDictionary_[key].publish, false);
                        eventPublishDictionary_[key].active = true;
                    }
                }
            }
        }


        if (DEBUG_ && verbose_)
        {
            window.console.log(window.document.URL + " - eventSubscribe: " + msg);
        }

        if (msg instanceof Array)
        {
            publishEvents(msg);
        }
        else if (typeof(msg) === "string")
        {
            publishEvents([msg]);
        }
        else
        {
            assert_(false, "unknown event data");
        }
    });

    /**
     *
     */
    wapi.subscribe("sysEventUnsubscribe", function (msg) {
        /**
         * Removes listener for events
         * @param {Array.<string>} events to remove.
         */
        function unsubscribeEvents(events) {
            for (var i = 0; i < events.length; i++)
            {
                var key = events[i];
                if (eventPublishDictionary_[key])
                {
                    if (eventPublishDictionary_[key].active)
                    {
                        window.removeEventListener(key, eventPublishDictionary_[key].publish, false);
                        eventPublishDictionary_[key].active = false;
                    }
                }
            }
        }


        if (DEBUG_ && verbose_)
        {
            window.console.log(window.document.URL + " - eventUnsubscribe: " + msg);
        }

        if (msg instanceof Array)
        {
            unsubscribeEvents(msg);
        }
        else if (typeof(msg) === "string")
        {
            unsubscribeEvents([msg]);
        }
        else
        {
            assert_(false, "unknown event data");
        }
    });
    //</editor-fold>

    //<editor-fold desc="Event Listeners">
    /**
     * TODO: is there a better name for message?
     * The message handler.
     */
    window.addEventListener("message", function (event) {
        /**
         * Subscribe to a topic.
         * @param {Window} srcWin -.
         * @param {TopicMessage_} message -.
         */
        function methodSubscribe(srcWin, message) {
            var topicName = message.topic;
            var srcComponentID = message.componentId;

            if (!TopicMap_[topicName])
            {
                TopicMap_[topicName] = new TopicEntry_(topicName);
            }
            TopicMap_[topicName].addSubscriber(srcWin, srcComponentID);
            if (window.parent != window)
            {
                window.parent.postMessage(new TopicMessage_(methodSubscribeStr_, topicName), "*");
            }
        }


        /**
         * Unsubscribe from the topic.
         * @param {Window} srcWin -.
         * @param {TopicMessage_} message -.
         */
        function methodUnsubscribe(srcWin, message) {
            var topicName = message.topic;

            if (TopicMap_[topicName])
            {
                var topic = TopicMap_[topicName];
                topic.removeSubscriber(srcWin);

                if (!topic.anyHandlers() && !topic.anySubscribers())
                {
                    window.parent.postMessage(new TopicMessage_(methodUnsubscribeStr_, topicName), "*");
                    delete TopicMap_[topicName];
                }
            }
        }


        /**
         * Publish the message to parent, child windows, and local handlers.
         * @param {Window} srcWin of message.
         * @param {TopicMessage_} message -.
         * @param {boolean} bubbleonly -.
         */
        function methodPublish(srcWin, message, bubbleonly) {
            publish_(message.topic, message, srcWin, bubbleonly);
        }


        /**
         * System publish, right now just going up to parents.
         * @param {Window} srcWin of message.
         * @param {TopicMessage_} message -.
         */
        function methodSystem(srcWin, message) {
            publish_(message.topic, message, srcWin, true);
        }

        if (event.data.type === typeOfMessage_)
        {
            if (DEBUG_ && verbose_)
            {
                window.console.log("      " + document.URL + " - " + event.data.method + ": [" + event.data.topic + "] " +
                                   event.data.componentId + ", " + event.data.messageId + ", " + event.data.timestamp);
            }


            switch (event.data.method)
            {
                case methodSubscribeStr_:
                    methodSubscribe(event.source, event.data);
                    break;

                case methodUnsubscribeStr_:
                    methodUnsubscribe(event.source, event.data);
                    break;

                case methodPublishStr_:
                    methodPublish(event.source, event.data, false);
                    break;

                case methodReadyStr_:
                    methodPublish(event.source, event.data, true);
                    break;

                default:
                    assert_(false, "unknown data method");
                    break;
            }
        }
    });


    /**
     *  TODO: pick the right event to publish READY
     *  load, DOMContentLoaded, other?
     */
    window.addEventListener("DOMContentLoaded", function () {
        /* this will distribute the ready topic to
         * just my ancestors.
         */
        publishToParent_(topicReady_, "ready");
    }, false);


    /**
     * TODO: pick the correct inverse.
     */
    window.addEventListener("unload", function () {
        /* this will distribute the unready topic to
         * just my ancestors.
         */

        if (DEBUG_ && verbose_)
        {
            window.console.log("*************unload: " + subscribedTopics_().join(",") + "   " + subscribedEvents_().join(","));
        }

        /* de-registerEvents_(subscribedEvents_()); */

        publishToParent_("sysShutdown", document.URL);
    }, false);
    //</editor-fold>

    //<editor-fold desc="DEBUGGING">
    if (DEBUG_)
    {
        wapi.dbgANote = "Any property starting with dbg will be removed in a release build";

        /**
         * Debugging - call this from the javascript console window to see
         * what events have been subscribed to
         * @return {Array.<string>} Events registered.
         */
        function dbgPublishedEvents_() {
            var publishedEvents = [];
            for (var key in eventPublishDictionary_)
            {
                if (eventPublishDictionary_.hasOwnProperty(key))
                {
                    if (eventPublishDictionary_[key].active)
                    {
                        publishedEvents.push(key);
                    }
                }
            }
            return publishedEvents;
        }


        verbose_ = true;

        wapi.dbgTopicMap = TopicMap_;
        wapi.dbgVerbose = verbose_;
        wapi.dbgAssert = assert_;

        wapi.dbgSubscribedEvents = subscribedEvents_;
        wapi.dbgSubscribedTopics = subscribedTopics_;

        wapi.dbgPublishedEvents = dbgPublishedEvents_;
    }
    //</editor-fold>

    window.wapi = wapi;
})();