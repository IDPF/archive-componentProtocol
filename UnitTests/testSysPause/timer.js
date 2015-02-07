/*
 * Simple sample code to toggle state of timers.
 */
var counter = 0;
var timer = document.getElementById("timer");
var source = document.getElementById("source");
var timerid = null;
var interval = 50;
var paused = false;

function handlePause(msg) {
    var e = document.getElementById("status");

    window.console.log(ackString + ": " + msg);
    e.innerHTML = "Topic: [paused]";
    paused = true;

}

function handleResume(msg) {
    var e = document.getElementById("status");

    window.console.log(ackString + ": " + msg);

    e.innerHTML = "Topic: [running]";
    paused = false;
}

source.innerHTML = window.document.URL + ":" + wapi.widgetID;

handleResume("resume");

timerid = window.setInterval(function () {
    timer.innerHTML = counter;
    if (paused == false)
    {
        counter += interval;
    }
    wapi.publish(ackString, String(counter))

}, interval);

wapi.subscribe(topicPause_, handlePause);
wapi.subscribe(topicResume_, handleResume);


