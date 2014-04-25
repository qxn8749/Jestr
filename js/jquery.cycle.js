/*!
 * jQuery Cycle Plugin (with Transition Definitions)
 * Examples and documentation at: http://jquery.malsup.com/cycle/
 * Copyright (c) 2007-2013 M. Alsup
 * Version: 3.0.3 (11-JUL-2013)
 * Dual licensed under the MIT and GPL licenses.
 * http://jquery.malsup.com/license.html
 * Requires: jQuery v1.7.1 or later
 */
;(function($, undefined) {
"use strict";

var ver = '3.0.3';

function debug(s) {
	if ($.fn.cycle.debug)
		log(s);
}		
function log() {
	/*global console */
	if (window.console && console.log)
		console.log('[cycle] ' + Array.prototype.join.call(arguments,' '));
}
$.expr[':'].paused = function(el) {
	return el.cyclePause;
};


// the options arg can be...
//   a number  - indicates an immediate transition should occur to the given slide index
//   a string  - 'pause', 'resume', 'toggle', 'next', 'prev', 'stop', 'destroy' or the name of a transition effect (ie, 'fade', 'zoom', etc)
//   an object - properties to control the slideshow
//
// the arg2 arg can be...
//   the name of an fx (only used in conjunction with a numeric value for 'options')
//   the value true (only used in first arg == 'resume') and indicates
//	 that the resume should occur immediately (not wait for next timeout)

$.fn.cycle = function(options, arg2) {
	var o = { s: this.selector, c: this.context };

	// in 1.3+ we can fix mistakes with the ready state
	if (this.length === 0 && options != 'stop') {
		if (!$.isReady && o.s) {
			log('DOM not ready, queuing slideshow');
			$(function() {
				$(o.s,o.c).cycle(options,arg2);
			});
			return this;
		}
		// is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
		log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
		return this;
	}

	// iterate the matched nodeset
	return this.each(function() {
		var opts = handleArguments(this, options, arg2);
		if (opts === false)
			return;

		opts.updateActivePagerLink = opts.updateActivePagerLink || $.fn.cycle.updateActivePagerLink;
		
		// stop existing slideshow for this container (if there is one)
		if (this.cycleTimeout)
			clearTimeout(this.cycleTimeout);
		this.cycleTimeout = this.cyclePause = 0;
		this.cycleStop = 0; // issue #108

		var $cont = $(this);
		var $slides = opts.slideExpr ? $(opts.slideExpr, this) : $cont.children();
		var els = $slides.get();

		if (els.length < 2) {
			log('terminating; too few slides: ' + els.length);
			return;
		}

		var opts2 = buildOptions($cont, $slides, els, opts, o);
		if (opts2 === false)
			return;

		var startTime = opts2.continuous ? 10 : getTimeout(els[opts2.currSlide], els[opts2.nextSlide], opts2, !opts2.backwards);

		// if it's an auto slideshow, kick it off
		if (startTime) {
			startTime += (opts2.delay || 0);
			if (startTime < 10)
				startTime = 10;
			debug('first timeout: ' + startTime);
			this.cycleTimeout = setTimeout(function(){go(els,opts2,0,!opts.backwards);}, startTime);
		}
	});
};

function triggerPause(cont, byHover, onPager) {
	var opts = $(cont).data('cycle.opts');
	if (!opts)
		return;
	var paused = !!cont.cyclePause;
	if (paused && opts.paused)
		opts.paused(cont, opts, byHover, onPager);
	else if (!paused && opts.resumed)
		opts.resumed(cont, opts, byHover, onPager);
}

// process the args that were passed to the plugin fn
function handleArguments(cont, options, arg2) {
	if (cont.cycleStop === undefined)
		cont.cycleStop = 0;
	if (options === undefined || options === null)
		options = {};
	if (options.constructor == String) {
		switch(options) {
		case 'destroy':
		case 'stop':
			var opts = $(cont).data('cycle.opts');
			if (!opts)
				return false;
			cont.cycleStop++; // callbacks look for change
			if (cont.cycleTimeout)
				clearTimeout(cont.cycleTimeout);
			cont.cycleTimeout = 0;
			if (opts.elements)
				$(opts.elements).stop();
			$(cont).removeData('cycle.opts');
			if (options == 'destroy')
				destroy(cont, opts);
			return false;
		case 'toggle':
			cont.cyclePause = (cont.cyclePause === 1) ? 0 : 1;
			checkInstantResume(cont.cyclePause, arg2, cont);
			triggerPause(cont);
			return false;
		case 'pause':
			cont.cyclePause = 1;
			triggerPause(cont);
			return false;
		case 'resume':
			cont.cyclePause = 0;
			checkInstantResume(false, arg2, cont);
			triggerPause(cont);
			return false;
		case 'prev':
		case 'next':
			opts = $(cont).data('cycle.opts');
			if (!opts) {
				log('options not found, "prev/next" ignored');
				return false;
			}
			if (typeof arg2 == 'string') 
				opts.oneTimeFx = arg2;
			$.fn.cycle[options](opts);
			return false;
		default:
			options = { fx: options };
		}
		return options;
	}
	else if (options.constructor == Number) {
		// go to the requested slide
		var num = options;
		options = $(cont).data('cycle.opts');
		if (!options) {
			log('options not found, can not advance slide');
			return false;
		}
		if (num < 0 || num >= options.elements.length) {
			log('invalid slide index: ' + num);
			return false;
		}
		options.nextSlide = num;
		if (cont.cycleTimeout) {
			clearTimeout(cont.cycleTimeout);
			cont.cycleTimeout = 0;
		}
		if (typeof arg2 == 'string')
			options.oneTimeFx = arg2;
		go(options.elements, options, 1, num >= options.currSlide);
		return false;
	}
	return options;
	
	function checkInstantResume(isPaused, arg2, cont) {
		if (!isPaused && arg2 === true) { // resume now!
			var options = $(cont).data('cycle.opts');
			if (!options) {
				log('options not found, can not resume');
				return false;
			}
			if (cont.cycleTimeout) {
				clearTimeout(cont.cycleTimeout);
				cont.cycleTimeout = 0;
			}
			go(options.elements, options, 1, !options.backwards);
		}
	}
}

function removeFilter(el, opts) {
	if (!$.support.opacity && opts.cleartype && el.style.filter) {
		try { el.style.removeAttribute('filter'); }
		catch(smother) {} // handle old opera versions
	}
}

// unbind event handlers
function destroy(cont, opts) {
	if (opts.next)
		$(opts.next).unbind(opts.prevNextEvent);
	if (opts.prev)
		$(opts.prev).unbind(opts.prevNextEvent);
	
	if (opts.pager || opts.pagerAnchorBuilder)
		$.each(opts.pagerAnchors || [], function() {
			this.unbind().remove();
		});
	opts.pagerAnchors = null;
	$(cont).unbind('mouseenter.cycle mouseleave.cycle');
	if (opts.destroy) // callback
		opts.destroy(opts);
}

// one-time initialization
function buildOptions($cont, $slides, els, options, o) {
	var startingSlideSpecified;
	// support metadata plugin (v1.0 and v2.0)
	var opts = $.extend({}, $.fn.cycle.defaults, options || {}, $.metadata ? $cont.metadata() : $.meta ? $cont.data() : {});
	var meta = $.isFunction($cont.data) ? $cont.data(opts.metaAttr) : null;
	if (meta)
		opts = $.extend(opts, meta);
	if (opts.autostop)
		opts.countdown = opts.autostopCount || els.length;

	var cont = $cont[0];
	$cont.data('cycle.opts', opts);
	opts.$cont = $cont;
	opts.stopCount = cont.cycleStop;
	opts.elements = els;
	opts.before = opts.before ? [opts.before] : [];
	opts.after = opts.after ? [opts.after] : [];

	// push some after callbacks
	if (!$.support.opacity && opts.cleartype)
		opts.after.push(function() { removeFilter(this, opts); });
	if (opts.continuous)
		opts.after.push(function() { go(els,opts,0,!opts.backwards); });

	saveOriginalOpts(opts);

	// clearType corrections
	if (!$.support.opacity && opts.cleartype && !opts.cleartypeNoBg)
		clearTypeFix($slides);

	// container requires non-static position so that slides can be position within
	if ($cont.css('position') == 'static')
		$cont.css('position', 'relative');
	if (opts.width)
		$cont.width(opts.width);
	if (opts.height && opts.height != 'auto')
		$cont.height(opts.height);

	if (opts.startingSlide !== undefined) {
		opts.startingSlide = parseInt(opts.startingSlide,10);
		if (opts.startingSlide >= els.length || opts.startSlide < 0)
			opts.startingSlide = 0; // catch bogus input
		else 
			startingSlideSpecified = true;
	}
	else if (opts.backwards)
		opts.startingSlide = els.length - 1;
	else
		opts.startingSlide = 0;

	// if random, mix up the slide array
	if (opts.random) {
		opts.randomMap = [];
		for (var i = 0; i < els.length; i++)
			opts.randomMap.push(i);
		opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
		if (startingSlideSpecified) {
			// try to find the specified starting slide and if found set start slide index in the map accordingly
			for ( var cnt = 0; cnt < els.length; cnt++ ) {
				if ( opts.startingSlide == opts.randomMap[cnt] ) {
					opts.randomIndex = cnt;
				}
			}
		}
		else {
			opts.randomIndex = 1;
			opts.startingSlide = opts.randomMap[1];
		}
	}
	else if (opts.startingSlide >= els.length)
		opts.startingSlide = 0; // catch bogus input
	opts.currSlide = opts.startingSlide || 0;
	var first = opts.startingSlide;

	// set position and zIndex on all the slides
	$slides.css({position: 'absolute', top:0, left:0}).hide().each(function(i) {
		var z;
		if (opts.backwards)
			z = first ? i <= first ? els.length + (i-first) : first-i : els.length-i;
		else
			z = first ? i >= first ? els.length - (i-first) : first-i : els.length-i;
		$(this).css('z-index', z);
	});

	// make sure first slide is visible
	$(els[first]).css('opacity',1).show(); // opacity bit needed to handle restart use case
	removeFilter(els[first], opts);

	// stretch slides
	if (opts.fit) {
		if (!opts.aspect) {
	        if (opts.width)
	            $slides.width(opts.width);
	        if (opts.height && opts.height != 'auto')
	            $slides.height(opts.height);
		} else {
			$slides.each(function(){
				var $slide = $(this);
				var ratio = (opts.aspect === true) ? $slide.width()/$slide.height() : opts.aspect;
				if( opts.width && $slide.width() != opts.width ) {
					$slide.width( opts.width );
					$slide.height( opts.width / ratio );
				}

				if( opts.height && $slide.height() < opts.height ) {
					$slide.height( opts.height );
					$slide.width( opts.height * ratio );
				}
			});
		}
	}

	if (opts.center && ((!opts.fit) || opts.aspect)) {
		$slides.each(function(){
			var $slide = $(this);
			$slide.css({
				"margin-left": opts.width ?
					((opts.width - $slide.width()) / 2) + "px" :
					0,
				"margin-top": opts.height ?
					((opts.height - $slide.height()) / 2) + "px" :
					0
			});
		});
	}

	if (opts.center && !opts.fit && !opts.slideResize) {
		$slides.each(function(){
			var $slide = $(this);
			$slide.css({
				"margin-left": opts.width ? ((opts.width - $slide.width()) / 2) + "px" : 0,
				"margin-top": opts.height ? ((opts.height - $slide.height()) / 2) + "px" : 0
			});
		});
	}
		
	// stretch container
	var reshape = (opts.containerResize || opts.containerResizeHeight) && $cont.innerHeight() < 1;
	if (reshape) { // do this only if container has no size http://tinyurl.com/da2oa9
		var maxw = 0, maxh = 0;
		for(var j=0; j < els.length; j++) {
			var $e = $(els[j]), e = $e[0], w = $e.outerWidth(), h = $e.outerHeight();
			if (!w) w = e.offsetWidth || e.width || $e.attr('width');
			if (!h) h = e.offsetHeight || e.height || $e.attr('height');
			maxw = w > maxw ? w : maxw;
			maxh = h > maxh ? h : maxh;
		}
		if (opts.containerResize && maxw > 0 && maxh > 0)
			$cont.css({width:maxw+'px',height:maxh+'px'});
		if (opts.containerResizeHeight && maxh > 0)
			$cont.css({height:maxh+'px'});
	}

	var pauseFlag = false;  // https://github.com/malsup/cycle/issues/44
	if (opts.pause)
		$cont.bind('mouseenter.cycle', function(){
			pauseFlag = true;
			this.cyclePause++;
			triggerPause(cont, true);
		}).bind('mouseleave.cycle', function(){
				if (pauseFlag)
					this.cyclePause--;
				triggerPause(cont, true);
		});

	if (supportMultiTransitions(opts) === false)
		return false;

	// apparently a lot of people use image slideshows without height/width attributes on the images.
	// Cycle 2.50+ requires the sizing info for every slide; this block tries to deal with that.
	var requeue = false;
	options.requeueAttempts = options.requeueAttempts || 0;
	$slides.each(function() {
		// try to get height/width of each slide
		var $el = $(this);
		this.cycleH = (opts.fit && opts.height) ? opts.height : ($el.height() || this.offsetHeight || this.height || $el.attr('height') || 0);
		this.cycleW = (opts.fit && opts.width) ? opts.width : ($el.width() || this.offsetWidth || this.width || $el.attr('width') || 0);

		if ( $el.is('img') ) {
			var loading = (this.cycleH === 0 && this.cycleW === 0 && !this.complete);
			// don't requeue for images that are still loading but have a valid size
			if (loading) {
				if (o.s && opts.requeueOnImageNotLoaded && ++options.requeueAttempts < 100) { // track retry count so we don't loop forever
					log(options.requeueAttempts,' - img slide not loaded, requeuing slideshow: ', this.src, this.cycleW, this.cycleH);
					setTimeout(function() {$(o.s,o.c).cycle(options);}, opts.requeueTimeout);
					requeue = true;
					return false; // break each loop
				}
				else {
					log('could not determine size of image: '+this.src, this.cycleW, this.cycleH);
				}
			}
		}
		return true;
	});

	if (requeue)
		return false;

	opts.cssBefore = opts.cssBefore || {};
	opts.cssAfter = opts.cssAfter || {};
	opts.cssFirst = opts.cssFirst || {};
	opts.animIn = opts.animIn || {};
	opts.animOut = opts.animOut || {};

	$slides.not(':eq('+first+')').css(opts.cssBefore);
	$($slides[first]).css(opts.cssFirst);

	if (opts.timeout) {
		opts.timeout = parseInt(opts.timeout,10);
		// ensure that timeout and speed settings are sane
		if (opts.speed.constructor == String)
			opts.speed = $.fx.speeds[opts.speed] || parseInt(opts.speed,10);
		if (!opts.sync)
			opts.speed = opts.speed / 2;
		
		var buffer = opts.fx == 'none' ? 0 : opts.fx == 'shuffle' ? 500 : 250;
		while((opts.timeout - opts.speed) < buffer) // sanitize timeout
			opts.timeout += opts.speed;
	}
	if (opts.easing)
		opts.easeIn = opts.easeOut = opts.easing;
	if (!opts.speedIn)
		opts.speedIn = opts.speed;
	if (!opts.speedOut)
		opts.speedOut = opts.speed;

	opts.slideCount = els.length;
	opts.currSlide = opts.lastSlide = first;
	if (opts.random) {
		if (++opts.randomIndex == els.length)
			opts.randomIndex = 0;
		opts.nextSlide = opts.randomMap[opts.randomIndex];
	}
	else if (opts.backwards)
		opts.nextSlide = opts.startingSlide === 0 ? (els.length-1) : opts.startingSlide-1;
	else
		opts.nextSlide = opts.startingSlide >= (els.length-1) ? 0 : opts.startingSlide+1;

	// run transition init fn
	if (!opts.multiFx) {
		var init = $.fn.cycle.transitions[opts.fx];
		if ($.isFunction(init))
			init($cont, $slides, opts);
		else if (opts.fx != 'custom' && !opts.multiFx) {
			log('unknown transition: ' + opts.fx,'; slideshow terminating');
			return false;
		}
	}

	// fire artificial events
	var e0 = $slides[first];
	if (!opts.skipInitializationCallbacks) {
		if (opts.before.length)
			opts.before[0].apply(e0, [e0, e0, opts, true]);
		if (opts.after.length)
			opts.after[0].apply(e0, [e0, e0, opts, true]);
	}
	if (opts.next)
		$(opts.next).bind(opts.prevNextEvent,function(){return advance(opts,1);});
	if (opts.prev)
		$(opts.prev).bind(opts.prevNextEvent,function(){return advance(opts,0);});
	if (opts.pager || opts.pagerAnchorBuilder)
		buildPager(els,opts);

	exposeAddSlide(opts, els);

	return opts;
}

// save off original opts so we can restore after clearing state
function saveOriginalOpts(opts) {
	opts.original = { before: [], after: [] };
	opts.original.cssBefore = $.extend({}, opts.cssBefore);
	opts.original.cssAfter  = $.extend({}, opts.cssAfter);
	opts.original.animIn	= $.extend({}, opts.animIn);
	opts.original.animOut   = $.extend({}, opts.animOut);
	$.each(opts.before, function() { opts.original.before.push(this); });
	$.each(opts.after,  function() { opts.original.after.push(this); });
}

function supportMultiTransitions(opts) {
	var i, tx, txs = $.fn.cycle.transitions;
	// look for multiple effects
	if (opts.fx.indexOf(',') > 0) {
		opts.multiFx = true;
		opts.fxs = opts.fx.replace(/\s*/g,'').split(',');
		// discard any bogus effect names
		for (i=0; i < opts.fxs.length; i++) {
			var fx = opts.fxs[i];
			tx = txs[fx];
			if (!tx || !txs.hasOwnProperty(fx) || !$.isFunction(tx)) {
				log('discarding unknown transition: ',fx);
				opts.fxs.splice(i,1);
				i--;
			}
		}
		// if we have an empty list then we threw everything away!
		if (!opts.fxs.length) {
			log('No valid transitions named; slideshow terminating.');
			return false;
		}
	}
	else if (opts.fx == 'all') {  // auto-gen the list of transitions
		opts.multiFx = true;
		opts.fxs = [];
		for (var p in txs) {
			if (txs.hasOwnProperty(p)) {
				tx = txs[p];
				if (txs.hasOwnProperty(p) && $.isFunction(tx))
					opts.fxs.push(p);
			}
		}
	}
	if (opts.multiFx && opts.randomizeEffects) {
		// munge the fxs array to make effect selection random
		var r1 = Math.floor(Math.random() * 20) + 30;
		for (i = 0; i < r1; i++) {
			var r2 = Math.floor(Math.random() * opts.fxs.length);
			opts.fxs.push(opts.fxs.splice(r2,1)[0]);
		}
		debug('randomized fx sequence: ',opts.fxs);
	}
	return true;
}

// provide a mechanism for adding slides after the slideshow has started
function exposeAddSlide(opts, els) {
	opts.addSlide = function(newSlide, prepend) {
		var $s = $(newSlide), s = $s[0];
		if (!opts.autostopCount)
			opts.countdown++;
		els[prepend?'unshift':'push'](s);
		if (opts.els)
			opts.els[prepend?'unshift':'push'](s); // shuffle needs this
		opts.slideCount = els.length;

		// add the slide to the random map and resort
		if (opts.random) {
			opts.randomMap.push(opts.slideCount-1);
			opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
		}

		$s.css('position','absolute');
		$s[prepend?'prependTo':'appendTo'](opts.$cont);

		if (prepend) {
			opts.currSlide++;
			opts.nextSlide++;
		}

		if (!$.support.opacity && opts.cleartype && !opts.cleartypeNoBg)
			clearTypeFix($s);

		if (opts.fit && opts.width)
			$s.width(opts.width);
		if (opts.fit && opts.height && opts.height != 'auto')
			$s.height(opts.height);
		s.cycleH = (opts.fit && opts.height) ? opts.height : $s.height();
		s.cycleW = (opts.fit && opts.width) ? opts.width : $s.width();

		$s.css(opts.cssBefore);

		if (opts.pager || opts.pagerAnchorBuilder)
			$.fn.cycle.createPagerAnchor(els.length-1, s, $(opts.pager), els, opts);

		if ($.isFunction(opts.onAddSlide))
			opts.onAddSlide($s);
		else
			$s.hide(); // default behavior
	};
}

// reset internal state; we do this on every pass in order to support multiple effects
$.fn.cycle.resetState = function(opts, fx) {
	fx = fx || opts.fx;
	opts.before = []; opts.after = [];
	opts.cssBefore = $.extend({}, opts.original.cssBefore);
	opts.cssAfter  = $.extend({}, opts.original.cssAfter);
	opts.animIn	= $.extend({}, opts.original.animIn);
	opts.animOut   = $.extend({}, opts.original.animOut);
	opts.fxFn = null;
	$.each(opts.original.before, function() { opts.before.push(this); });
	$.each(opts.original.after,  function() { opts.after.push(this); });

	// re-init
	var init = $.fn.cycle.transitions[fx];
	if ($.isFunction(init))
		init(opts.$cont, $(opts.elements), opts);
};

// this is the main engine fn, it handles the timeouts, callbacks and slide index mgmt
function go(els, opts, manual, fwd) {
	var p = opts.$cont[0], curr = els[opts.currSlide], next = els[opts.nextSlide];

	// opts.busy is true if we're in the middle of an animation
	if (manual && opts.busy && opts.manualTrump) {
		// let manual transitions requests trump active ones
		debug('manualTrump in go(), stopping active transition');
		$(els).stop(true,true);
		opts.busy = 0;
		clearTimeout(p.cycleTimeout);
	}

	// don't begin another timeout-based transition if there is one active
	if (opts.busy) {
		debug('transition active, ignoring new tx request');
		return;
	}


	// stop cycling if we have an outstanding stop request
	if (p.cycleStop != opts.stopCount || p.cycleTimeout === 0 && !manual)
		return;

	// check to see if we should stop cycling based on autostop options
	if (!manual && !p.cyclePause && !opts.bounce &&
		((opts.autostop && (--opts.countdown <= 0)) ||
		(opts.nowrap && !opts.random && opts.nextSlide < opts.currSlide))) {
		if (opts.end)
			opts.end(opts);
		return;
	}

	// if slideshow is paused, only transition on a manual trigger
	var changed = false;
	if ((manual || !p.cyclePause) && (opts.nextSlide != opts.currSlide)) {
		changed = true;
		var fx = opts.fx;
		// keep trying to get the slide size if we don't have it yet
		curr.cycleH = curr.cycleH || $(curr).height();
		curr.cycleW = curr.cycleW || $(curr).width();
		next.cycleH = next.cycleH || $(next).height();
		next.cycleW = next.cycleW || $(next).width();

		// support multiple transition types
		if (opts.multiFx) {
			if (fwd && (opts.lastFx === undefined || ++opts.lastFx >= opts.fxs.length))
				opts.lastFx = 0;
			else if (!fwd && (opts.lastFx === undefined || --opts.lastFx < 0))
				opts.lastFx = opts.fxs.length - 1;
			fx = opts.fxs[opts.lastFx];
		}

		// one-time fx overrides apply to:  $('div').cycle(3,'zoom');
		if (opts.oneTimeFx) {
			fx = opts.oneTimeFx;
			opts.oneTimeFx = null;
		}

		$.fn.cycle.resetState(opts, fx);

		// run the before callbacks
		if (opts.before.length)
			$.each(opts.before, function(i,o) {
				if (p.cycleStop != opts.stopCount) return;
				o.apply(next, [curr, next, opts, fwd]);
			});

		// stage the after callacks
		var after = function() {
			opts.busy = 0;
			$.each(opts.after, function(i,o) {
				if (p.cycleStop != opts.stopCount) return;
				o.apply(next, [curr, next, opts, fwd]);
			});
			if (!p.cycleStop) {
				// queue next transition
				queueNext();
			}
		};

		debug('tx firing('+fx+'); currSlide: ' + opts.currSlide + '; nextSlide: ' + opts.nextSlide);
		
		// get ready to perform the transition
		opts.busy = 1;
		if (opts.fxFn) // fx function provided?
			opts.fxFn(curr, next, opts, after, fwd, manual && opts.fastOnEvent);
		else if ($.isFunction($.fn.cycle[opts.fx])) // fx plugin ?
			$.fn.cycle[opts.fx](curr, next, opts, after, fwd, manual && opts.fastOnEvent);
		else
			$.fn.cycle.custom(curr, next, opts, after, fwd, manual && opts.fastOnEvent);
	}
	else {
		queueNext();
	}

	if (changed || opts.nextSlide == opts.currSlide) {
		// calculate the next slide
		var roll;
		opts.lastSlide = opts.currSlide;
		if (opts.random) {
			opts.currSlide = opts.nextSlide;
			if (++opts.randomIndex == els.length) {
				opts.randomIndex = 0;
				opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
			}
			opts.nextSlide = opts.randomMap[opts.randomIndex];
			if (opts.nextSlide == opts.currSlide)
				opts.nextSlide = (opts.currSlide == opts.slideCount - 1) ? 0 : opts.currSlide + 1;
		}
		else if (opts.backwards) {
			roll = (opts.nextSlide - 1) < 0;
			if (roll && opts.bounce) {
				opts.backwards = !opts.backwards;
				opts.nextSlide = 1;
				opts.currSlide = 0;
			}
			else {
				opts.nextSlide = roll ? (els.length-1) : opts.nextSlide-1;
				opts.currSlide = roll ? 0 : opts.nextSlide+1;
			}
		}
		else { // sequence
			roll = (opts.nextSlide + 1) == els.length;
			if (roll && opts.bounce) {
				opts.backwards = !opts.backwards;
				opts.nextSlide = els.length-2;
				opts.currSlide = els.length-1;
			}
			else {
				opts.nextSlide = roll ? 0 : opts.nextSlide+1;
				opts.currSlide = roll ? els.length-1 : opts.nextSlide-1;
			}
		}
	}
	if (changed && opts.pager)
		opts.updateActivePagerLink(opts.pager, opts.currSlide, opts.activePagerClass);
	
	function queueNext() {
		// stage the next transition
		var ms = 0, timeout = opts.timeout;
		if (opts.timeout && !opts.continuous) {
			ms = getTimeout(els[opts.currSlide], els[opts.nextSlide], opts, fwd);
         if (opts.fx == 'shuffle')
            ms -= opts.speedOut;
      }
		else if (opts.continuous && p.cyclePause) // continuous shows work off an after callback, not this timer logic
			ms = 10;
		if (ms > 0)
			p.cycleTimeout = setTimeout(function(){ go(els, opts, 0, !opts.backwards); }, ms);
	}
}

// invoked after transition
$.fn.cycle.updateActivePagerLink = function(pager, currSlide, clsName) {
   $(pager).each(function() {
       $(this).children().removeClass(clsName).eq(currSlide).addClass(clsName);
   });
};

// calculate timeout value for current transition
function getTimeout(curr, next, opts, fwd) {
	if (opts.timeoutFn) {
		// call user provided calc fn
		var t = opts.timeoutFn.call(curr,curr,next,opts,fwd);
		while (opts.fx != 'none' && (t - opts.speed) < 250) // sanitize timeout
			t += opts.speed;
		debug('calculated timeout: ' + t + '; speed: ' + opts.speed);
		if (t !== false)
			return t;
	}
	return opts.timeout;
}

// expose next/prev function, caller must pass in state
$.fn.cycle.next = function(opts) { advance(opts,1); };
$.fn.cycle.prev = function(opts) { advance(opts,0);};

// advance slide forward or back
function advance(opts, moveForward) {
	var val = moveForward ? 1 : -1;
	var els = opts.elements;
	var p = opts.$cont[0], timeout = p.cycleTimeout;
	if (timeout) {
		clearTimeout(timeout);
		p.cycleTimeout = 0;
	}
	if (opts.random && val < 0) {
		// move back to the previously display slide
		opts.randomIndex--;
		if (--opts.randomIndex == -2)
			opts.randomIndex = els.length-2;
		else if (opts.randomIndex == -1)
			opts.randomIndex = els.length-1;
		opts.nextSlide = opts.randomMap[opts.randomIndex];
	}
	else if (opts.random) {
		opts.nextSlide = opts.randomMap[opts.randomIndex];
	}
	else {
		opts.nextSlide = opts.currSlide + val;
		if (opts.nextSlide < 0) {
			if (opts.nowrap) return false;
			opts.nextSlide = els.length - 1;
		}
		else if (opts.nextSlide >= els.length) {
			if (opts.nowrap) return false;
			opts.nextSlide = 0;
		}
	}

	var cb = opts.onPrevNextEvent || opts.prevNextClick; // prevNextClick is deprecated
	if ($.isFunction(cb))
		cb(val > 0, opts.nextSlide, els[opts.nextSlide]);
	go(els, opts, 1, moveForward);
	return false;
}

function buildPager(els, opts) {
	var $p = $(opts.pager);
	$.each(els, function(i,o) {
		$.fn.cycle.createPagerAnchor(i,o,$p,els,opts);
	});
	opts.updateActivePagerLink(opts.pager, opts.startingSlide, opts.activePagerClass);
}

$.fn.cycle.createPagerAnchor = function(i, el, $p, els, opts) {
	var a;
	if ($.isFunction(opts.pagerAnchorBuilder)) {
		a = opts.pagerAnchorBuilder(i,el);
		debug('pagerAnchorBuilder('+i+', el) returned: ' + a);
	}
	else
		a = '<a href="#">'+(i+1)+'</a>';
		
	if (!a)
		return;
	var $a = $(a);
	// don't reparent if anchor is in the dom
	if ($a.parents('body').length === 0) {
		var arr = [];
		if ($p.length > 1) {
			$p.each(function() {
				var $clone = $a.clone(true);
				$(this).append($clone);
				arr.push($clone[0]);
			});
			$a = $(arr);
		}
		else {
			$a.appendTo($p);
		}
	}

	opts.pagerAnchors =  opts.pagerAnchors || [];
	opts.pagerAnchors.push($a);
	
	var pagerFn = function(e) {
		e.preventDefault();
		opts.nextSlide = i;
		var p = opts.$cont[0], timeout = p.cycleTimeout;
		if (timeout) {
			clearTimeout(timeout);
			p.cycleTimeout = 0;
		}
		var cb = opts.onPagerEvent || opts.pagerClick; // pagerClick is deprecated
		if ($.isFunction(cb))
			cb(opts.nextSlide, els[opts.nextSlide]);
		go(els,opts,1,opts.currSlide < i); // trigger the trans
//		return false; // <== allow bubble
	};
	
	if ( /mouseenter|mouseover/i.test(opts.pagerEvent) ) {
		$a.hover(pagerFn, function(){/* no-op */} );
	}
	else {
		$a.bind(opts.pagerEvent, pagerFn);
	}
	
	if ( ! /^click/.test(opts.pagerEvent) && !opts.allowPagerClickBubble)
		$a.bind('click.cycle', function(){return false;}); // suppress click
	
	var cont = opts.$cont[0];
	var pauseFlag = false; // https://github.com/malsup/cycle/issues/44
	if (opts.pauseOnPagerHover) {
		$a.hover(
			function() { 
				pauseFlag = true;
				cont.cyclePause++; 
				triggerPause(cont,true,true);
			}, function() { 
				if (pauseFlag)
					cont.cyclePause--; 
				triggerPause(cont,true,true);
			} 
		);
	}
};

// helper fn to calculate the number of slides between the current and the next
$.fn.cycle.hopsFromLast = function(opts, fwd) {
	var hops, l = opts.lastSlide, c = opts.currSlide;
	if (fwd)
		hops = c > l ? c - l : opts.slideCount - l;
	else
		hops = c < l ? l - c : l + opts.slideCount - c;
	return hops;
};

// fix clearType problems in ie6 by setting an explicit bg color
// (otherwise text slides look horrible during a fade transition)
function clearTypeFix($slides) {
	debug('applying clearType background-color hack');
	function hex(s) {
		s = parseInt(s,10).toString(16);
		return s.length < 2 ? '0'+s : s;
	}
	function getBg(e) {
		for ( ; e && e.nodeName.toLowerCase() != 'html'; e = e.parentNode) {
			var v = $.css(e,'background-color');
			if (v && v.indexOf('rgb') >= 0 ) {
				var rgb = v.match(/\d+/g);
				return '#'+ hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
			}
			if (v && v != 'transparent')
				return v;
		}
		return '#ffffff';
	}
	$slides.each(function() { $(this).css('background-color', getBg(this)); });
}

// reset common props before the next transition
$.fn.cycle.commonReset = function(curr,next,opts,w,h,rev) {
	$(opts.elements).not(curr).hide();
	if (typeof opts.cssBefore.opacity == 'undefined')
		opts.cssBefore.opacity = 1;
	opts.cssBefore.display = 'block';
	if (opts.slideResize && w !== false && next.cycleW > 0)
		opts.cssBefore.width = next.cycleW;
	if (opts.slideResize && h !== false && next.cycleH > 0)
		opts.cssBefore.height = next.cycleH;
	opts.cssAfter = opts.cssAfter || {};
	opts.cssAfter.display = 'none';
	$(curr).css('zIndex',opts.slideCount + (rev === true ? 1 : 0));
	$(next).css('zIndex',opts.slideCount + (rev === true ? 0 : 1));
};

// the actual fn for effecting a transition
$.fn.cycle.custom = function(curr, next, opts, cb, fwd, speedOverride) {
	var $l = $(curr), $n = $(next);
	var speedIn = opts.speedIn, speedOut = opts.speedOut, easeIn = opts.easeIn, easeOut = opts.easeOut, animInDelay = opts.animInDelay, animOutDelay = opts.animOutDelay;
	$n.css(opts.cssBefore);
	if (speedOverride) {
		if (typeof speedOverride == 'number')
			speedIn = speedOut = speedOverride;
		else
			speedIn = speedOut = 1;
		easeIn = easeOut = null;
	}
	var fn = function() {
		$n.delay(animInDelay).animate(opts.animIn, speedIn, easeIn, function() {
			cb();
		});
	};
	$l.delay(animOutDelay).animate(opts.animOut, speedOut, easeOut, function() {
		$l.css(opts.cssAfter);
		if (!opts.sync) 
			fn();
	});
	if (opts.sync) fn();
};

// transition definitions - only fade is defined here, transition pack defines the rest
$.fn.cycle.transitions = {
	fade: function($cont, $slides, opts) {
		$slides.not(':eq('+opts.currSlide+')').css('opacity',0);
		opts.before.push(function(curr,next,opts) {
			$.fn.cycle.commonReset(curr,next,opts);
			opts.cssBefore.opacity = 0;
		});
		opts.animIn	   = { opacity: 1 };
		opts.animOut   = { opacity: 0 };
		opts.cssBefore = { top: 0, left: 0 };
	}
};

$.fn.cycle.ver = function() { return ver; };

// override these globally if you like (they are all optional)
$.fn.cycle.defaults = {
    activePagerClass: 'activeSlide', // class name used for the active pager link
    after:            null,     // transition callback (scope set to element that was shown):  function(currSlideElement, nextSlideElement, options, forwardFlag)
    allowPagerClickBubble: false, // allows or prevents click event on pager anchors from bubbling
    animIn:           null,     // properties that define how the slide animates in
    animInDelay:      0,        // allows delay before next slide transitions in	
    animOut:          null,     // properties that define how the slide animates out
    animOutDelay:     0,        // allows delay before current slide transitions out
    aspect:           false,    // preserve aspect ratio during fit resizing, cropping if necessary (must be used with fit option)
    autostop:         0,        // true to end slideshow after X transitions (where X == slide count)
    autostopCount:    0,        // number of transitions (optionally used with autostop to define X)
    backwards:        false,    // true to start slideshow at last slide and move backwards through the stack
    before:           null,     // transition callback (scope set to element to be shown):     function(currSlideElement, nextSlideElement, options, forwardFlag)
    center:           null,     // set to true to have cycle add top/left margin to each slide (use with width and height options)
    cleartype:        !$.support.opacity,  // true if clearType corrections should be applied (for IE)
    cleartypeNoBg:    false,    // set to true to disable extra cleartype fixing (leave false to force background color setting on slides)
    containerResize:  1,        // resize container to fit largest slide
    containerResizeHeight:  0,  // resize containers height to fit the largest slide but leave the width dynamic
    continuous:       0,        // true to start next transition immediately after current one completes
    cssAfter:         null,     // properties that defined the state of the slide after transitioning out
    cssBefore:        null,     // properties that define the initial state of the slide before transitioning in
    delay:            0,        // additional delay (in ms) for first transition (hint: can be negative)
    easeIn:           null,     // easing for "in" transition
    easeOut:          null,     // easing for "out" transition
    easing:           null,     // easing method for both in and out transitions
    end:              null,     // callback invoked when the slideshow terminates (use with autostop or nowrap options): function(options)
    fastOnEvent:      0,        // force fast transitions when triggered manually (via pager or prev/next); value == time in ms
    fit:              0,        // force slides to fit container
    fx:               'fade',   // name of transition effect (or comma separated names, ex: 'fade,scrollUp,shuffle')
    fxFn:             null,     // function used to control the transition: function(currSlideElement, nextSlideElement, options, afterCalback, forwardFlag)
    height:           'auto',   // container height (if the 'fit' option is true, the slides will be set to this height as well)
    manualTrump:      true,     // causes manual transition to stop an active transition instead of being ignored
    metaAttr:         'cycle',  // data- attribute that holds the option data for the slideshow
    next:             null,     // element, jQuery object, or jQuery selector string for the element to use as event trigger for next slide
    nowrap:           0,        // true to prevent slideshow from wrapping
    onPagerEvent:     null,     // callback fn for pager events: function(zeroBasedSlideIndex, slideElement)
    onPrevNextEvent:  null,     // callback fn for prev/next events: function(isNext, zeroBasedSlideIndex, slideElement)
    pager:            null,     // element, jQuery object, or jQuery selector string for the element to use as pager container
    pagerAnchorBuilder: null,   // callback fn for building anchor links:  function(index, DOMelement)
    pagerEvent:       'click.cycle', // name of event which drives the pager navigation
    pause:            0,        // true to enable "pause on hover"
    pauseOnPagerHover: 0,       // true to pause when hovering over pager link
    prev:             null,     // element, jQuery object, or jQuery selector string for the element to use as event trigger for previous slide
    prevNextEvent:    'click.cycle',// event which drives the manual transition to the previous or next slide
    random:           0,        // true for random, false for sequence (not applicable to shuffle fx)
    randomizeEffects: 1,        // valid when multiple effects are used; true to make the effect sequence random
    requeueOnImageNotLoaded: true, // requeue the slideshow if any image slides are not yet loaded
    requeueTimeout:   250,      // ms delay for requeue
    rev:              0,        // causes animations to transition in reverse (for effects that support it such as scrollHorz/scrollVert/shuffle)
    shuffle:          null,     // coords for shuffle animation, ex: { top:15, left: 200 }
    skipInitializationCallbacks: false, // set to true to disable the first before/after callback that occurs prior to any transition
    slideExpr:        null,     // expression for selecting slides (if something other than all children is required)
    slideResize:      1,        // force slide width/height to fixed size before every transition
    speed:            1000,     // speed of the transition (any valid fx speed value)
    speedIn:          null,     // speed of the 'in' transition
    speedOut:         null,     // speed of the 'out' transition
    startingSlide:    undefined,// zero-based index of the first slide to be displayed
    sync:             1,        // true if in/out transitions should occur simultaneously
    timeout:          4000,     // milliseconds between slide transitions (0 to disable auto advance)
    timeoutFn:        null,     // callback for determining per-slide timeout value:  function(currSlideElement, nextSlideElement, options, forwardFlag)
    updateActivePagerLink: null,// callback fn invoked to update the active pager link (adds/removes activePagerClass style)
    width:            null      // container width (if the 'fit' option is true, the slides will be set to this width as well)
};

})(jQuery);


/*!
 * jQuery Cycle Plugin Transition Definitions
 * This script is a plugin for the jQuery Cycle Plugin
 * Examples and documentation at: http://malsup.com/jquery/cycle/
 * Copyright (c) 2007-2010 M. Alsup
 * Version:	 2.73
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 */
(function($) {
"use strict";

//
// These functions define slide initialization and properties for the named
// transitions. To save file size feel free to remove any of these that you
// don't need.
//
$.fn.cycle.transitions.none = function($cont, $slides, opts) {
	opts.fxFn = function(curr,next,opts,after){
		$(next).show();
		$(curr).hide();
		after();
	};
};

// not a cross-fade, fadeout only fades out the top slide
$.fn.cycle.transitions.fadeout = function($cont, $slides, opts) {
	$slides.not(':eq('+opts.currSlide+')').css({ display: 'block', 'opacity': 1 });
	opts.before.push(function(curr,next,opts,w,h,rev) {
		$(curr).css('zIndex',opts.slideCount + (rev !== true ? 1 : 0));
		$(next).css('zIndex',opts.slideCount + (rev !== true ? 0 : 1));
	});
	opts.animIn.opacity = 1;
	opts.animOut.opacity = 0;
	opts.cssBefore.opacity = 1;
	opts.cssBefore.display = 'block';
	opts.cssAfter.zIndex = 0;
};

// scrollUp/Down/Left/Right
$.fn.cycle.transitions.scrollUp = function($cont, $slides, opts) {
	$cont.css('overflow','hidden');
	opts.before.push($.fn.cycle.commonReset);
	var h = $cont.height();
	opts.cssBefore.top = h;
	opts.cssBefore.left = 0;
	opts.cssFirst.top = 0;
	opts.animIn.top = 0;
	opts.animOut.top = -h;
};
$.fn.cycle.transitions.scrollDown = function($cont, $slides, opts) {
	$cont.css('overflow','hidden');
	opts.before.push($.fn.cycle.commonReset);
	var h = $cont.height();
	opts.cssFirst.top = 0;
	opts.cssBefore.top = -h;
	opts.cssBefore.left = 0;
	opts.animIn.top = 0;
	opts.animOut.top = h;
};
$.fn.cycle.transitions.scrollLeft = function($cont, $slides, opts) {
	$cont.css('overflow','hidden');
	opts.before.push($.fn.cycle.commonReset);
	var w = $cont.width();
	opts.cssFirst.left = 0;
	opts.cssBefore.left = w;
	opts.cssBefore.top = 0;
	opts.animIn.left = 0;
	opts.animOut.left = 0-w;
};
$.fn.cycle.transitions.scrollRight = function($cont, $slides, opts) {
	$cont.css('overflow','hidden');
	opts.before.push($.fn.cycle.commonReset);
	var w = $cont.width();
	opts.cssFirst.left = 0;
	opts.cssBefore.left = -w;
	opts.cssBefore.top = 0;
	opts.animIn.left = 0;
	opts.animOut.left = w;
};
$.fn.cycle.transitions.scrollHorz = function($cont, $slides, opts) {
	$cont.css('overflow','hidden').width();
	opts.before.push(function(curr, next, opts, fwd) {
		if (opts.rev)
			fwd = !fwd;
		$.fn.cycle.commonReset(curr,next,opts);
		opts.cssBefore.left = fwd ? (next.cycleW-1) : (1-next.cycleW);
		opts.animOut.left = fwd ? -curr.cycleW : curr.cycleW;
	});
	opts.cssFirst.left = 0;
	opts.cssBefore.top = 0;
	opts.animIn.left = 0;
	opts.animOut.top = 0;
};
$.fn.cycle.transitions.scrollVert = function($cont, $slides, opts) {
	$cont.css('overflow','hidden');
	opts.before.push(function(curr, next, opts, fwd) {
		if (opts.rev)
			fwd = !fwd;
		$.fn.cycle.commonReset(curr,next,opts);
		opts.cssBefore.top = fwd ? (1-next.cycleH) : (next.cycleH-1);
		opts.animOut.top = fwd ? curr.cycleH : -curr.cycleH;
	});
	opts.cssFirst.top = 0;
	opts.cssBefore.left = 0;
	opts.animIn.top = 0;
	opts.animOut.left = 0;
};

// slideX/slideY
$.fn.cycle.transitions.slideX = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$(opts.elements).not(curr).hide();
		$.fn.cycle.commonReset(curr,next,opts,false,true);
		opts.animIn.width = next.cycleW;
	});
	opts.cssBefore.left = 0;
	opts.cssBefore.top = 0;
	opts.cssBefore.width = 0;
	opts.animIn.width = 'show';
	opts.animOut.width = 0;
};
$.fn.cycle.transitions.slideY = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$(opts.elements).not(curr).hide();
		$.fn.cycle.commonReset(curr,next,opts,true,false);
		opts.animIn.height = next.cycleH;
	});
	opts.cssBefore.left = 0;
	opts.cssBefore.top = 0;
	opts.cssBefore.height = 0;
	opts.animIn.height = 'show';
	opts.animOut.height = 0;
};

// shuffle
$.fn.cycle.transitions.shuffle = function($cont, $slides, opts) {
	var i, w = $cont.css('overflow', 'visible').width();
	$slides.css({left: 0, top: 0});
	opts.before.push(function(curr,next,opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,true,true);
	});
	// only adjust speed once!
	if (!opts.speedAdjusted) {
		opts.speed = opts.speed / 2; // shuffle has 2 transitions
		opts.speedAdjusted = true;
	}
	opts.random = 0;
	opts.shuffle = opts.shuffle || {left:-w, top:15};
	opts.els = [];
	for (i=0; i < $slides.length; i++)
		opts.els.push($slides[i]);

	for (i=0; i < opts.currSlide; i++)
		opts.els.push(opts.els.shift());

	// custom transition fn (hat tip to Benjamin Sterling for this bit of sweetness!)
	opts.fxFn = function(curr, next, opts, cb, fwd) {
		if (opts.rev)
			fwd = !fwd;
		var $el = fwd ? $(curr) : $(next);
		$(next).css(opts.cssBefore);
		var count = opts.slideCount;
		$el.animate(opts.shuffle, opts.speedIn, opts.easeIn, function() {
			var hops = $.fn.cycle.hopsFromLast(opts, fwd);
			for (var k=0; k < hops; k++) {
				if (fwd)
					opts.els.push(opts.els.shift());
				else
					opts.els.unshift(opts.els.pop());
			}
			if (fwd) {
				for (var i=0, len=opts.els.length; i < len; i++)
					$(opts.els[i]).css('z-index', len-i+count);
			}
			else {
				var z = $(curr).css('z-index');
				$el.css('z-index', parseInt(z,10)+1+count);
			}
			$el.animate({left:0, top:0}, opts.speedOut, opts.easeOut, function() {
				$(fwd ? this : curr).hide();
				if (cb) cb();
			});
		});
	};
	$.extend(opts.cssBefore, { display: 'block', opacity: 1, top: 0, left: 0 });
};

// turnUp/Down/Left/Right
$.fn.cycle.transitions.turnUp = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,false);
		opts.cssBefore.top = next.cycleH;
		opts.animIn.height = next.cycleH;
		opts.animOut.width = next.cycleW;
	});
	opts.cssFirst.top = 0;
	opts.cssBefore.left = 0;
	opts.cssBefore.height = 0;
	opts.animIn.top = 0;
	opts.animOut.height = 0;
};
$.fn.cycle.transitions.turnDown = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,false);
		opts.animIn.height = next.cycleH;
		opts.animOut.top   = curr.cycleH;
	});
	opts.cssFirst.top = 0;
	opts.cssBefore.left = 0;
	opts.cssBefore.top = 0;
	opts.cssBefore.height = 0;
	opts.animOut.height = 0;
};
$.fn.cycle.transitions.turnLeft = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,false,true);
		opts.cssBefore.left = next.cycleW;
		opts.animIn.width = next.cycleW;
	});
	opts.cssBefore.top = 0;
	opts.cssBefore.width = 0;
	opts.animIn.left = 0;
	opts.animOut.width = 0;
};
$.fn.cycle.transitions.turnRight = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,false,true);
		opts.animIn.width = next.cycleW;
		opts.animOut.left = curr.cycleW;
	});
	$.extend(opts.cssBefore, { top: 0, left: 0, width: 0 });
	opts.animIn.left = 0;
	opts.animOut.width = 0;
};

// zoom
$.fn.cycle.transitions.zoom = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,false,false,true);
		opts.cssBefore.top = next.cycleH/2;
		opts.cssBefore.left = next.cycleW/2;
		$.extend(opts.animIn, { top: 0, left: 0, width: next.cycleW, height: next.cycleH });
		$.extend(opts.animOut, { width: 0, height: 0, top: curr.cycleH/2, left: curr.cycleW/2 });
	});
	opts.cssFirst.top = 0;
	opts.cssFirst.left = 0;
	opts.cssBefore.width = 0;
	opts.cssBefore.height = 0;
};

// fadeZoom
$.fn.cycle.transitions.fadeZoom = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,false,false);
		opts.cssBefore.left = next.cycleW/2;
		opts.cssBefore.top = next.cycleH/2;
		$.extend(opts.animIn, { top: 0, left: 0, width: next.cycleW, height: next.cycleH });
	});
	opts.cssBefore.width = 0;
	opts.cssBefore.height = 0;
	opts.animOut.opacity = 0;
};

// blindX
$.fn.cycle.transitions.blindX = function($cont, $slides, opts) {
	var w = $cont.css('overflow','hidden').width();
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts);
		opts.animIn.width = next.cycleW;
		opts.animOut.left   = curr.cycleW;
	});
	opts.cssBefore.left = w;
	opts.cssBefore.top = 0;
	opts.animIn.left = 0;
	opts.animOut.left = w;
};
// blindY
$.fn.cycle.transitions.blindY = function($cont, $slides, opts) {
	var h = $cont.css('overflow','hidden').height();
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts);
		opts.animIn.height = next.cycleH;
		opts.animOut.top   = curr.cycleH;
	});
	opts.cssBefore.top = h;
	opts.cssBefore.left = 0;
	opts.animIn.top = 0;
	opts.animOut.top = h;
};
// blindZ
$.fn.cycle.transitions.blindZ = function($cont, $slides, opts) {
	var h = $cont.css('overflow','hidden').height();
	var w = $cont.width();
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts);
		opts.animIn.height = next.cycleH;
		opts.animOut.top   = curr.cycleH;
	});
	opts.cssBefore.top = h;
	opts.cssBefore.left = w;
	opts.animIn.top = 0;
	opts.animIn.left = 0;
	opts.animOut.top = h;
	opts.animOut.left = w;
};

// growX - grow horizontally from centered 0 width
$.fn.cycle.transitions.growX = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,false,true);
		opts.cssBefore.left = this.cycleW/2;
		opts.animIn.left = 0;
		opts.animIn.width = this.cycleW;
		opts.animOut.left = 0;
	});
	opts.cssBefore.top = 0;
	opts.cssBefore.width = 0;
};
// growY - grow vertically from centered 0 height
$.fn.cycle.transitions.growY = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,false);
		opts.cssBefore.top = this.cycleH/2;
		opts.animIn.top = 0;
		opts.animIn.height = this.cycleH;
		opts.animOut.top = 0;
	});
	opts.cssBefore.height = 0;
	opts.cssBefore.left = 0;
};

// curtainX - squeeze in both edges horizontally
$.fn.cycle.transitions.curtainX = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,false,true,true);
		opts.cssBefore.left = next.cycleW/2;
		opts.animIn.left = 0;
		opts.animIn.width = this.cycleW;
		opts.animOut.left = curr.cycleW/2;
		opts.animOut.width = 0;
	});
	opts.cssBefore.top = 0;
	opts.cssBefore.width = 0;
};
// curtainY - squeeze in both edges vertically
$.fn.cycle.transitions.curtainY = function($cont, $slides, opts) {
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,false,true);
		opts.cssBefore.top = next.cycleH/2;
		opts.animIn.top = 0;
		opts.animIn.height = next.cycleH;
		opts.animOut.top = curr.cycleH/2;
		opts.animOut.height = 0;
	});
	opts.cssBefore.height = 0;
	opts.cssBefore.left = 0;
};

// cover - curr slide covered by next slide
$.fn.cycle.transitions.cover = function($cont, $slides, opts) {
	var d = opts.direction || 'left';
	var w = $cont.css('overflow','hidden').width();
	var h = $cont.height();
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts);
		opts.cssAfter.display = '';
		if (d == 'right')
			opts.cssBefore.left = -w;
		else if (d == 'up')
			opts.cssBefore.top = h;
		else if (d == 'down')
			opts.cssBefore.top = -h;
		else
			opts.cssBefore.left = w;
	});
	opts.animIn.left = 0;
	opts.animIn.top = 0;
	opts.cssBefore.top = 0;
	opts.cssBefore.left = 0;
};

// uncover - curr slide moves off next slide
$.fn.cycle.transitions.uncover = function($cont, $slides, opts) {
	var d = opts.direction || 'left';
	var w = $cont.css('overflow','hidden').width();
	var h = $cont.height();
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,true,true);
		if (d == 'right')
			opts.animOut.left = w;
		else if (d == 'up')
			opts.animOut.top = -h;
		else if (d == 'down')
			opts.animOut.top = h;
		else
			opts.animOut.left = -w;
	});
	opts.animIn.left = 0;
	opts.animIn.top = 0;
	opts.cssBefore.top = 0;
	opts.cssBefore.left = 0;
};

// toss - move top slide and fade away
$.fn.cycle.transitions.toss = function($cont, $slides, opts) {
	var w = $cont.css('overflow','visible').width();
	var h = $cont.height();
	opts.before.push(function(curr, next, opts) {
		$.fn.cycle.commonReset(curr,next,opts,true,true,true);
		// provide default toss settings if animOut not provided
		if (!opts.animOut.left && !opts.animOut.top)
			$.extend(opts.animOut, { left: w*2, top: -h/2, opacity: 0 });
		else
			opts.animOut.opacity = 0;
	});
	opts.cssBefore.left = 0;
	opts.cssBefore.top = 0;
	opts.animIn.left = 0;
};

// wipe - clip animation
$.fn.cycle.transitions.wipe = function($cont, $slides, opts) {
	var w = $cont.css('overflow','hidden').width();
	var h = $cont.height();
	opts.cssBefore = opts.cssBefore || {};
	var clip;
	if (opts.clip) {
		if (/l2r/.test(opts.clip))
			clip = 'rect(0px 0px '+h+'px 0px)';
		else if (/r2l/.test(opts.clip))
			clip = 'rect(0px '+w+'px '+h+'px '+w+'px)';
		else if (/t2b/.test(opts.clip))
			clip = 'rect(0px '+w+'px 0px 0px)';
		else if (/b2t/.test(opts.clip))
			clip = 'rect('+h+'px '+w+'px '+h+'px 0px)';
		else if (/zoom/.test(opts.clip)) {
			var top = parseInt(h/2,10);
			var left = parseInt(w/2,10);
			clip = 'rect('+top+'px '+left+'px '+top+'px '+left+'px)';
		}
	}

	opts.cssBefore.clip = opts.cssBefore.clip || clip || 'rect(0px 0px 0px 0px)';

	var d = opts.cssBefore.clip.match(/(\d+)/g);
	var t = parseInt(d[0],10), r = parseInt(d[1],10), b = parseInt(d[2],10), l = parseInt(d[3],10);

	opts.before.push(function(curr, next, opts) {
		if (curr == next) return;
		var $curr = $(curr), $next = $(next);
		$.fn.cycle.commonReset(curr,next,opts,true,true,false);
		opts.cssAfter.display = 'block';

		var step = 1, count = parseInt((opts.speedIn / 13),10) - 1;
		(function f() {
			var tt = t ? t - parseInt(step * (t/count),10) : 0;
			var ll = l ? l - parseInt(step * (l/count),10) : 0;
			var bb = b < h ? b + parseInt(step * ((h-b)/count || 1),10) : h;
			var rr = r < w ? r + parseInt(step * ((w-r)/count || 1),10) : w;
			$next.css({ clip: 'rect('+tt+'px '+rr+'px '+bb+'px '+ll+'px)' });
			(step++ <= count) ? setTimeout(f, 13) : $curr.css('display', 'none');
		})();
	});
	$.extend(opts.cssBefore, { display: 'block', opacity: 1, top: 0, left: 0 });
	opts.animIn	   = { left: 0 };
	opts.animOut   = { left: 0 };
};

})(jQuery);


/**
 * @preserve Flux Slider v1.4.4
 * http://www.joelambert.co.uk/flux
 *
 * Copyright 2011, Joe Lambert.
 * Free to use under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 */

// Flux namespace
window.flux = {
	version: '1.4.4'
};

(function($){
	flux.slider = function(elem, opts) {
		// Setup the flux.browser singleton to perform feature detection
		flux.browser.init();

		if(!flux.browser.supportsTransitions)
		{
			if(window.console && window.console.error)
				console.error("Flux Slider requires a browser that supports CSS3 transitions");
		}

		var _this = this;

		this.element = $(elem);

		// Make a list of all available transitions
		this.transitions = [];
		for(var fx in flux.transitions)
			this.transitions.push(fx);

		this.options = $.extend({
			autoplay: true,
			transitions: this.transitions,
			delay: 4000,
			pagination: true,
			controls: false,
			captions: false,
			width: null,
			height: null,
			onTransitionEnd: null
		}, opts);

		// Set the height/width if given [EXPERIMENTAL!]
		this.height = this.options.height ? this.options.height	: null;
		this.width 	= this.options.width  ? this.options.width 	: null;

		// Filter out non compatible transitions
		var newTrans = [];
		$(this.options.transitions).each(function(index, tran){
			var t = new flux.transitions[tran](this),
				compatible = true;
			
			if(t.options.requires3d && !flux.browser.supports3d)
				compatible = false;
				
			if(t.options.compatibilityCheck)
				compatible = t.options.compatibilityCheck();

			if(compatible)
				newTrans.push(tran);
		});		

		this.options.transitions = newTrans;

		this.images = new Array();
		this.imageLoadedCount = 0;
		this.currentImageIndex = 0;
		this.nextImageIndex = 1;
		this.playing = false;


		this.container = $('<div class="fluxslider"></div>').appendTo(this.element);
		
		this.surface = $('<div class="surface" style="position: relative"></div>').appendTo(this.container);
		
		// Listen for click events as we may want to follow a link
		this.container.bind('click', function(event) {
			if($(event.target).hasClass('hasLink'))
				window.location = $(event.target).data('href');
		});

		this.imageContainer = $('<div class="images loading"></div>').css({
			'position': 'relative',
			'overflow': 'hidden',
			'min-height': '100px'
		}).appendTo(this.surface);
		
		// If the height/width is already set then resize the container
		if(this.width && this.height)
		{
			this.imageContainer.css({
				width: this.width+'px',
				height: this.height+'px'
			});
		}

		// Create the placeholders for the current and next image
		this.image1 = $('<div class="image1" style="height: 100%; width: 100%"></div>').appendTo(this.imageContainer);
		this.image2 = $('<div class="image2" style="height: 100%; width: 100%"></div>').appendTo(this.imageContainer);

		$(this.image1).add(this.image2).css({
			'position': 'absolute',
			'top': '0px',
			'left': '0px'
		});
		
		// Get a list of the images to use
		this.element.find('img, a img').each(function(index, found_img){
			var imgClone = found_img.cloneNode(false),
				link = $(found_img).parent();

			// If this img is directly inside a link then save the link for later use
			if(link.is('a'))
				$(imgClone).data('href', link.attr('href'));

			_this.images.push(imgClone);

			// Remove the images from the DOM
			$(found_img).remove();
		});
		
		// Load the images afterwards as IE seems to load images synchronously
		for(var i=0; i<this.images.length; i++) {
			var image = new Image();
			image.onload = function() {
				_this.imageLoadedCount++;

				_this.width  = _this.width 	? _this.width  : this.width;
				_this.height = _this.height ? _this.height : this.height;

				if(_this.imageLoadedCount >= _this.images.length)
				{
					_this.finishedLoading();
					_this.setupImages();
				}
			};

			// Load the image to ensure its cached by the browser
			image.src = this.images[i].src;
		}
		
		// Catch when a transition has finished
		this.element.bind('fluxTransitionEnd', function(event, data) {
			// If the slider is currently playing then set the timeout for the next transition
			// if(_this.isPlaying())
			// 	_this.start();
			
			// Are we using a callback instead of events for notifying about transition ends?
			if(_this.options.onTransitionEnd) {					
				event.preventDefault();
				_this.options.onTransitionEnd(data);
			}
		});

		// Should we auto start the slider?
		if(this.options.autoplay)
			this.start();
			
		// Handle swipes
		this.element.bind('swipeLeft', function(event){
			_this.next(null, {direction: 'left'});
		}).bind('swipeRight', function(event){
			_this.prev(null, {direction: 'right'});
		});
		
		// Under FF7 autoplay breaks when the current tab loses focus
		setTimeout(function(){
			$(window).focus(function(){
				if(_this.isPlaying())
					_this.next();
			});
		}, 100);
	};

	flux.slider.prototype = {
		constructor: flux.slider,
		playing: false,
		start: function() {
			var _this = this;
			this.playing = true;
			this.interval = setInterval(function() {
				console.log('play');
				_this.transition();
			}, this.options.delay);
		},
		stop: function() {
			this.playing = false;
			clearInterval(this.interval);
			this.interval = null;
		},
		isPlaying: function() {
			return this.playing;
			//return this.interval != null;
		},
		next: function(trans, opts) {
			opts = opts || {};
			opts.direction = 'left';
			this.showImage(this.currentImageIndex+1, trans, opts);
		},
		prev: function(trans, opts) {
			opts = opts || {};
			opts.direction = 'right';
			this.showImage(this.currentImageIndex-1, trans, opts);
		},
		showImage: function(index, trans, opts) {
			this.setNextIndex(index);
			
			// Temporarily stop the transition interval
			//clearInterval(this.interval);
			//this.interval = null;
			
			this.setupImages();
			this.transition(trans, opts);
		},  
		finishedLoading: function() {
			var _this = this;

			this.container.css({
				width: this.width+'px',
				height: this.height+'px'
			});

			this.imageContainer.removeClass('loading');

			// Should we setup a pagination view?
			if(this.options.pagination)
			{
				// TODO: Attach to touch events if appropriate
				this.pagination = $('<ul class="pagination"></ul>').css({
					margin: '0px',
					padding: '0px',
					'text-align': 'center'
				});

				this.pagination.bind('click', function(event){
					event.preventDefault();
					_this.showImage($(event.target).data('index'));
				});

				$(this.images).each(function(index, image){
					var li = $('<li data-index="'+index+'">'+(index+1)+'</li>').css({
						display: 'inline-block',
						'margin-left': '0.5em',
						'cursor': 'pointer'
					}).appendTo(_this.pagination);

					if(index == 0)
						li.css('margin-left', 0).addClass('current');
				});

				this.container.append(this.pagination);
			}

			// Resize
			$(this.imageContainer).css({
				width: this.width+'px',
				height: this.height+'px'
			});

			$(this.image1).css({
				width: this.width+'px',
				height: this.height+'px'
			});

			$(this.image2).css({
				width: this.width+'px',
				height: this.height+'px'
			});

			this.container.css({
				width: this.width+'px',
				height: this.height+(this.options.pagination?this.pagination.height():0)+'px'
			});
			
			// Should we add prev/next controls?
			if(this.options.controls)
			{
				var css = {
					padding: '4px 10px 10px',
					'font-size': '60px',
					'font-family': 'arial, sans-serif',
					'line-height': '1em',
					'font-weight': 'bold',
					color: '#FFF',
					'text-decoration': 'none',
					background: 'rgba(0,0,0,0.5)',
					position: 'absolute',
					'z-index': 2000
				};
				
				this.nextButton = $('<a href="#">Â»</a>').css(css).css3({
					'border-radius': '4px'
				}).appendTo(this.surface).bind('click', function(event){
					event.preventDefault();
					_this.next();
				});
				
				this.prevButton = $('<a href="#">Â«</a>').css(css).css3({
					'border-radius': '4px'
				}).appendTo(this.surface).bind('click', function(event){
					event.preventDefault();
					_this.prev();
				});
				
				var top = (this.height - this.nextButton.height())/2;
				this.nextButton.css({
					top: top+'px',
					right: '10px'
				});
				
				this.prevButton.css({
					top: top+'px',
					left: '10px'
				});
			}
			
			// Should we use captions?
			if(this.options.captions)
			{
				this.captionBar = $('<div class="caption"></div>').css({
					background: 'rgba(0,0,0,0.6)',
					color: '#FFF',
					'font-size': '16px',
					'font-family': 'helvetica, arial, sans-serif',
					'text-decoration': 'none',
					'font-weight': 'bold',
					padding: '1.5em 1em',
					opacity: 0,
					position: 'absolute',
					'z-index': 110,
					width: '100%',
					bottom: 0
				}).css3({
					'transition-property': 'opacity',
					'transition-duration': '800ms',
					'box-sizing': 'border-box'
				}).prependTo(this.surface);
			}
			
			this.updateCaption();
		},
		setupImages: function() {
			var img1 = this.getImage(this.currentImageIndex),
				css1 = {
					'background-image': 'url("'+img1.src+'")',
					'z-index': 101,
					'cursor': 'auto'
				};

			// Does this image have an associated link?
			if($(img1).data('href'))
			{
				css1.cursor = 'pointer';
				this.image1.addClass('hasLink');
				this.image1.data('href', $(img1).data('href'));
			}
			else
			{
				this.image1.removeClass('hasLink');
				this.image1.data('href', null);
			}

			this.image1.css(css1).children().remove();

			this.image2.css({
				'background-image': 'url("'+this.getImage(this.nextImageIndex).src+'")',
				'z-index': 100
			}).show();

			if(this.options.pagination && this.pagination)
			{
				this.pagination.find('li.current').removeClass('current');
				$(this.pagination.find('li')[this.currentImageIndex]).addClass('current');
			}
		},
		transition: function(transition, opts) {
			// Allow a transition to be picked from ALL available transitions (not just the reduced set)
	        if(transition == undefined || !flux.transitions[transition])
	        {
	            // Pick a transition at random from the (possibly reduced set of) transitions
	            var index = Math.floor(Math.random()*(this.options.transitions.length));
	            transition = this.options.transitions[index];
	        }
			
			var tran = null;

			try {
		        tran = new flux.transitions[transition](this, $.extend(this.options[transition] ? this.options[transition] : {}, opts));
			}
			catch(e) {
				// If an invalid transition has been provided then use the fallback (default is to just switch the image)
				tran = new flux.transition(this, {fallback: true});
			}

	        tran.run();
			
	        this.currentImageIndex = this.nextImageIndex;
	        this.setNextIndex(this.currentImageIndex+1);
			this.updateCaption();
		},
		updateCaption: function() {
			var str = $(this.getImage(this.currentImageIndex)).attr('title');
			if(this.options.captions && this.captionBar)
			{
				if(str !== "")
					this.captionBar.html(str);
					
				this.captionBar.css('opacity', str === "" ? 0 : 1);
			}
		},
		getImage: function(index) {
			index = index % this.images.length;

			return this.images[index];
		},
		setNextIndex: function(nextIndex)
		{
			if(nextIndex == undefined)
				nextIndex = this.currentImageIndex+1;

			this.nextImageIndex = nextIndex;

			if(this.nextImageIndex > this.images.length-1)
				this.nextImageIndex = 0;

			if(this.nextImageIndex < 0)
				this.nextImageIndex = this.images.length-1;
		},
		increment: function() {
			this.currentImageIndex++;
			if(this.currentImageIndex > this.images.length-1)
				this.currentImageIndex = 0;
		}
	};
})(window.jQuery || window.Zepto);

/**
 * Helper object to determine support for various CSS3 functions
 * @author Joe Lambert
 */

(function($) {
	flux.browser = {
		init: function() {
			// Have we already been initialised?
			if(flux.browser.supportsTransitions !== undefined)
				return;

			var div = document.createElement('div'),
				prefixes = ['-webkit', '-moz', '-o', '-ms'],
				domPrefixes = ['Webkit', 'Moz', 'O', 'Ms'];

			// Does the current browser support CSS Transitions?
			if(window.Modernizr && Modernizr.csstransitions !== undefined)
				flux.browser.supportsTransitions = Modernizr.csstransitions;
			else
			{
				flux.browser.supportsTransitions = this.supportsCSSProperty('Transition');
			}

			// Does the current browser support 3D CSS Transforms?
			if(window.Modernizr && Modernizr.csstransforms3d !== undefined)
				flux.browser.supports3d = Modernizr.csstransforms3d;
			else
			{
				// Custom detection when Modernizr isn't available
				flux.browser.supports3d = this.supportsCSSProperty("Perspective");
				
				if ( flux.browser.supports3d && 'webkitPerspective' in $('body').get(0).style ) {
					// Double check with a media query (similar to how Modernizr does this)
					var div3D = $('<div id="csstransform3d"></div>');
					var mq = $('<style media="(transform-3d), ('+prefixes.join('-transform-3d),(')+'-transform-3d)">div#csstransform3d { position: absolute; left: 9px }</style>');

					$('body').append(div3D);
					$('head').append(mq);

					flux.browser.supports3d = div3D.get(0).offsetLeft == 9;

					div3D.remove();
					mq.remove();	
				}
			}

		},
		supportsCSSProperty: function(prop) {
			var div = document.createElement('div'),
				prefixes = ['-webkit', '-moz', '-o', '-ms'],
				domPrefixes = ['Webkit', 'Moz', 'O', 'Ms'];
				
			var support = false;
			for(var i=0; i<domPrefixes.length; i++)
			{
				if(domPrefixes[i]+prop in div.style)
					support = support || true;
			}
			
			return support;
		},
		translate: function(x, y, z) {
			x = (x != undefined) ? x : 0;
			y = (y != undefined) ? y : 0;
			z = (z != undefined) ? z : 0;

			return 'translate' + (flux.browser.supports3d ? '3d(' : '(') + x + 'px,' + y + (flux.browser.supports3d ? 'px,' + z + 'px)' : 'px)');
		},

		rotateX: function(deg) {
			return flux.browser.rotate('x', deg);
		},

		rotateY: function(deg) {
			return flux.browser.rotate('y', deg);
		},

		rotateZ: function(deg) {
			return flux.browser.rotate('z', deg);
		},

		rotate: function(axis, deg) {
			if(!axis in {'x':'', 'y':'', 'z':''})
				axis = 'z';

			deg = (deg != undefined) ? deg : 0;

			if(flux.browser.supports3d)
				return 'rotate3d('+(axis == 'x' ? '1' : '0')+', '+(axis == 'y' ? '1' : '0')+', '+(axis == 'z' ? '1' : '0')+', '+deg+'deg)';
			else
			{
				if(axis == 'z')
					return 'rotate('+deg+'deg)';
				else
					return '';
			}
		}
	};

	$(function(){
		// To continue to work with legacy code, ensure that flux.browser is initialised on document ready at the latest
		flux.browser.init();
	});
})(window.jQuery || window.Zepto);

(function($){
	/**
	 * Helper function for cross-browser CSS3 support, prepends all possible prefixes to all properties passed in
	 * @param {Object} props Ker/value pairs of CSS3 properties
	 */
	$.fn.css3 = function(props) {
		var css = {};
		var prefixes = ['webkit', 'moz', 'ms', 'o'];

		for(var prop in props)
		{
			// Add the vendor specific versions
			for(var i=0; i<prefixes.length; i++)
				css['-'+prefixes[i]+'-'+prop] = props[prop];
			
			// Add the actual version	
			css[prop] = props[prop];
		}
		
		this.css(css);
		return this;
	};
	
	/**
	 * Helper function to bind to the correct transition end event
	 * @param {function} callback The function to call when the event fires
	 */
	$.fn.transitionEnd = function(callback) {
		var _this = this;
		
		var events = ['webkitTransitionEnd', 'transitionend', 'oTransitionEnd'];
		
		for(var i=0; i < events.length; i++)
		{
			this.bind(events[i], function(event){
				// Automatically stop listening for the event
				for(var j=0; j<events.length;j++)
					$(this).unbind(events[j]);

				// Perform the callback function
				if(callback)
					callback.call(this, event);
			});
		}
		
		return this;
	};

	flux.transition = function(fluxslider, opts) {
		this.options = $.extend({
			requires3d: false,
			after: function() {
				// Default callback for after the transition has completed
			}
		}, opts);

		this.slider = fluxslider;

		// We need to ensure transitions degrade gracefully if the transition is unsupported or not loaded
		if((this.options.requires3d && !flux.browser.supports3d) || !flux.browser.supportsTransitions || this.options.fallback === true)
		{
			var _this = this;
			
			this.options.after = undefined;

			this.options.setup = function() {
				//console.error("Fallback setup()");
				_this.fallbackSetup();
			};
			
			this.options.execute = function() {
				//console.error("Fallback execute()");
				_this.fallbackExecute();
			};
		}
	};

	flux.transition.prototype = {
		constructor: flux.transition,
		hasFinished: false, // This is a lock to ensure that the fluxTransitionEnd event is only fired once per tansition
		run: function() {
			var _this = this;

			// do something
			if(this.options.setup !== undefined)
				this.options.setup.call(this);
			
			// Remove the background image from the top image
			this.slider.image1.css({
				'background-image': 'none'
			});

			this.slider.imageContainer.css('overflow', this.options.requires3d ? 'visible' : 'hidden');

			// For some of the 3D effects using Zepto we need to delay the transitions for some reason
			setTimeout(function(){
				if(_this.options.execute !== undefined)
					_this.options.execute.call(_this);
			}, 5);
		},
		finished: function() {
			if(this.hasFinished)
				return;
				
			this.hasFinished = true;
			
			if(this.options.after)
				this.options.after.call(this);

			this.slider.imageContainer.css('overflow', 'hidden');	

			this.slider.setupImages();

			// Trigger an event to signal the end of a transition
			this.slider.element.trigger('fluxTransitionEnd', {
				currentImage: this.slider.getImage(this.slider.currentImageIndex)
			});
		},
		fallbackSetup: function() {
			
		},
		fallbackExecute: function() {
			this.finished();
		}
	};

	flux.transitions = {};
	
	// Flux grid transition
	
	flux.transition_grid = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			columns: 6,
			rows: 6,
			forceSquare: false,
			setup: function() {
				var imgWidth = this.slider.image1.width(),
					imgHeight = this.slider.image1.height();
					
				var colWidth = Math.floor(imgWidth / this.options.columns),
					rowHeight = Math.floor(imgHeight / this.options.rows);
					
				if(this.options.forceSquare)
				{
					rowHeight = colWidth;
					this.options.rows = Math.floor(imgHeight / rowHeight);
				}

				// Work out how much space remains with the adjusted barWidth
				var colRemainder = imgWidth - (this.options.columns * colWidth),
					colAddPerLoop = Math.ceil(colRemainder / this.options.columns),
					
					rowRemainder = imgHeight - (this.options.rows * rowHeight),
					rowAddPerLoop = Math.ceil(rowRemainder / this.options.rows),
					
					delayBetweenBars = 150,
					height = this.slider.image1.height(),
					totalLeft = 0,
					totalTop = 0,
					fragment = document.createDocumentFragment();
				
				for(var i=0; i<this.options.columns; i++) {
					var thisColWidth = colWidth,
						totalTop = 0;

					if(colRemainder > 0)
					{
						var add = colRemainder >= colAddPerLoop ? colAddPerLoop : colRemainder;
						thisColWidth += add;
						colRemainder -= add;
					}
					
					for(var j=0; j<this.options.rows; j++)
					{
						var thisRowHeight = rowHeight,
							thisRowRemainder = rowRemainder;

						if(thisRowRemainder > 0)
						{
							var add = thisRowRemainder >= rowAddPerLoop ? rowAddPerLoop : thisRowRemainder;
							thisRowHeight += add;
							thisRowRemainder -= add;
						}
						
						var tile = $('<div class="tile tile-'+i+'-'+j+'"></div>').css({
							width: thisColWidth+'px',
							height: thisRowHeight+'px',
							position: 'absolute',
							top: totalTop+'px',
							left: totalLeft+'px'
						});
						
						this.options.renderTile.call(this, tile, i, j, thisColWidth, thisRowHeight, totalLeft, totalTop);
						
						fragment.appendChild(tile.get(0));
						
						totalTop += thisRowHeight;
					}
					
					totalLeft += thisColWidth;
				}

				// Append the fragement to the surface
				this.slider.image1.get(0).appendChild(fragment);
			},
			execute: function() {
				var _this = this,
					height = this.slider.image1.height(),
					bars = this.slider.image1.find('div.barcontainer');

				this.slider.image2.hide();

				// Get notified when the last transition has completed
				bars.last().transitionEnd(function(event){
					_this.slider.image2.show();

					_this.finished();
				});

				bars.css3({
					'transform': flux.browser.rotateX(-90) + ' ' + flux.browser.translate(0, height/2, height/2)
				});
			},
			renderTile: function(elem, colIndex, rowIndex, colWidth, rowHeight, leftOffset, topOffset) {
				
			}
		}, opts));	
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.bars = function(fluxslider, opts) {
		return new flux.transition_grid(fluxslider, $.extend({
			columns: 10,
			rows: 1,
			delayBetweenBars: 40,
			renderTile: function(elem, colIndex, rowIndex, colWidth, rowHeight, leftOffset, topOffset) {
				$(elem).css({
					'background-image': this.slider.image1.css('background-image'),
					'background-position': '-'+leftOffset+'px 0px'
				}).css3({
					'transition-duration': '400ms',
					'transition-timing-function': 'ease-in',
					'transition-property': 'all',
					'transition-delay': (colIndex*this.options.delayBetweenBars)+'ms'
				});
			},
			execute: function() {
				var _this = this;
	
				var height = this.slider.image1.height();
	
				var bars = this.slider.image1.find('div.tile');
	
				// Get notified when the last transition has completed
				$(bars[bars.length-1]).transitionEnd(function(){
					_this.finished();
				});
				
				setTimeout(function(){
					bars.css({
						'opacity': '0.5'
					}).css3({
						'transform': flux.browser.translate(0, height)
					});
				}, 50);
				
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.bars3d = function(fluxslider, opts) {
		return new flux.transition_grid(fluxslider, $.extend({
			requires3d: true,
			columns: 7,
			rows: 1,
			delayBetweenBars: 150,
			perspective: 1000,
			renderTile: function(elem, colIndex, rowIndex, colWidth, rowHeight, leftOffset, topOffset) {
				var bar = $('<div class="bar-'+colIndex+'"></div>').css({
					width: colWidth+'px',
					height: '100%',
					position: 'absolute',
					top: '0px',
					left: '0px',
					'z-index': 200,

					'background-image': this.slider.image1.css('background-image'),
					'background-position': '-'+leftOffset+'px 0px',
					'background-repeat': 'no-repeat'
				}).css3({
					'backface-visibility': 'hidden'
				}),

				bar2 = $(bar.get(0).cloneNode(false)).css({
					'background-image': this.slider.image2.css('background-image')
				}).css3({
					'transform': flux.browser.rotateX(90) + ' ' + flux.browser.translate(0, -rowHeight/2, rowHeight/2)
				}),

				left = $('<div class="side bar-'+colIndex+'"></div>').css({
					width: rowHeight+'px',
					height: rowHeight+'px',
					position: 'absolute',
					top: '0px',
					left: '0px',
					background: '#222',
					'z-index': 190
				}).css3({
					'transform': flux.browser.rotateY(90) + ' ' + flux.browser.translate(rowHeight/2, 0, -rowHeight/2) + ' ' + flux.browser.rotateY(180),
					'backface-visibility': 'hidden'
				}),

				right = $(left.get(0).cloneNode(false)).css3({
					'transform': flux.browser.rotateY(90) + ' ' + flux.browser.translate(rowHeight/2, 0, colWidth-rowHeight/2)
				});

				$(elem).css({
					width: colWidth+'px',
					height: '100%',
					position: 'absolute',
					top: '0px',
					left: leftOffset+'px',
					'z-index': colIndex > this.options.columns/2 ? 1000-colIndex : 1000 // Fix for Chrome to ensure that the z-index layering is correct!
				}).css3({
					'transition-duration': '800ms',
					'transition-timing-function': 'linear',
					'transition-property': 'all',
					'transition-delay': (colIndex*this.options.delayBetweenBars)+'ms',
					'transform-style': 'preserve-3d'
				}).append(bar).append(bar2).append(left).append(right);
			},
			execute: function() {
				this.slider.image1.css3({
					'perspective': this.options.perspective,
					'perspective-origin': '50% 50%'
				}).css({
					'-moz-transform': 'perspective('+this.options.perspective+'px)',
					'-moz-perspective': 'none',
					'-moz-transform-style': 'preserve-3d'
				});
				
				var _this = this,
					height = this.slider.image1.height(),
					bars = this.slider.image1.find('div.tile');

				this.slider.image2.hide();

				// Get notified when the last transition has completed
				bars.last().transitionEnd(function(event){
					_this.slider.image1.css3({
						'transform-style': 'flat'
					});
					
					_this.slider.image2.show();

					_this.finished();
				});
				
				setTimeout(function(){
					bars.css3({
						'transform': flux.browser.rotateX(-90) + ' ' + flux.browser.translate(0, height/2, height/2)
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {	
	flux.transitions.blinds = function(fluxslider, opts) {
		return new flux.transitions.bars(fluxslider, $.extend({
			execute: function() {
				var _this = this;

				var height = this.slider.image1.height();

				var bars = this.slider.image1.find('div.tile');

				// Get notified when the last transition has completed
				$(bars[bars.length-1]).transitionEnd(function(){
					_this.finished();
				});
				
				setTimeout(function(){
					bars.css({
						'opacity': '0.5'
					}).css3({
						'transform': 'scalex(0.0001)'
					});
				}, 50);
			}
		}, opts));
	}
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.blinds3d = function(fluxslider, opts) {
		return new flux.transitions.tiles3d(fluxslider, $.extend({
			forceSquare: false,
			rows: 1,
			columns: 6
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.zip = function(fluxslider, opts) {
		return new flux.transitions.bars(fluxslider, $.extend({
			execute: function() {
				var _this = this;

				var height = this.slider.image1.height();

				var bars = this.slider.image1.find('div.tile');

				// Get notified when the last transition has completed
				$(bars[bars.length-1]).transitionEnd(function(){
					_this.finished();
				});
				
				setTimeout(function(){
					bars.each(function(index, bar){						
						$(bar).css({
							'opacity': '0.3'
						}).css3({
							'transform': flux.browser.translate(0, (index%2 ? '-'+(2*height) : height))
						});		
					});
				}, 20);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.blocks = function(fluxslider, opts) {
		return new flux.transition_grid(fluxslider, $.extend({
			forceSquare: true,
			delayBetweenBars: 100,
			renderTile: function(elem, colIndex, rowIndex, colWidth, rowHeight, leftOffset, topOffset) {
				var delay = Math.floor(Math.random()*10*this.options.delayBetweenBars);
				
				$(elem).css({
					'background-image': this.slider.image1.css('background-image'),
					'background-position': '-'+leftOffset+'px -'+topOffset+'px'
				}).css3({
					'transition-duration': '350ms',
					'transition-timing-function': 'ease-in',
					'transition-property': 'all',
					'transition-delay': delay+'ms'
				});
				
				// Keep track of the last elem to fire
				if(this.maxDelay === undefined)
					this.maxDelay = 0;
					
				if(delay > this.maxDelay)
				{
					this.maxDelay = delay;
					this.maxDelayTile = elem;
				}
			},
			execute: function() {
				var _this = this;
	
				var blocks = this.slider.image1.find('div.tile');
	
				// Get notified when the last transition has completed
				this.maxDelayTile.transitionEnd(function(){
					_this.finished();
				});
	
				setTimeout(function(){
					blocks.each(function(index, block){				
						$(block).css({
							'opacity': '0'
						}).css3({
							'transform': 'scale(0.8)'
						});
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.blocks2 = function(fluxslider, opts) {
		return new flux.transition_grid(fluxslider, $.extend({
			cols: 12,
			forceSquare: true,
			delayBetweenDiagnols: 150,
			renderTile: function(elem, colIndex, rowIndex, colWidth, rowHeight, leftOffset, topOffset) {
				var delay = Math.floor(Math.random()*10*this.options.delayBetweenBars);
				
				$(elem).css({
					'background-image': this.slider.image1.css('background-image'),
					'background-position': '-'+leftOffset+'px -'+topOffset+'px'
				}).css3({
					'transition-duration': '350ms',
					'transition-timing-function': 'ease-in',
					'transition-property': 'all',
					'transition-delay': (colIndex+rowIndex)*this.options.delayBetweenDiagnols+'ms',
					'backface-visibility': 'hidden' // trigger hardware acceleration
				});
			},
			execute: function() {
				var _this = this;
	
				var blocks = this.slider.image1.find('div.tile');
	
				// Get notified when the last transition has completed
				blocks.last().transitionEnd(function(){
					_this.finished();
				});
				
				setTimeout(function(){
					blocks.each(function(index, block){				
						$(block).css({
							'opacity': '0'
						}).css3({
							'transform': 'scale(0.8)'
						});
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.concentric = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			blockSize: 60,
			delay: 150,
			alternate: false,
			setup: function() {
				var w = this.slider.image1.width(),
					h = this.slider.image1.height(),
					largestLength = Math.sqrt(w*w + h*h), // Largest length is the diagonal

					// How many blocks do we need?
					blockCount = Math.ceil(((largestLength-this.options.blockSize)/2) / this.options.blockSize) + 1, // 1 extra to account for the round border
					fragment = document.createDocumentFragment();

				for(var i=0; i<blockCount; i++)
				{
					var thisBlockSize = (2*i*this.options.blockSize)+this.options.blockSize;

					var block = $('<div></div>').attr('class', 'block block-'+i).css({
						width: thisBlockSize+'px',
						height: thisBlockSize+'px',
						position: 'absolute',
						top: ((h-thisBlockSize)/2)+'px',
						left: ((w-thisBlockSize)/2)+'px',

						'z-index': 100+(blockCount-i),

						'background-image': this.slider.image1.css('background-image'),
						'background-position': 'center center'
					}).css3({
						'border-radius': thisBlockSize+'px',
						'transition-duration': '800ms',
						'transition-timing-function': 'linear',
						'transition-property': 'all',
						'transition-delay': ((blockCount-i)*this.options.delay)+'ms'
					});

					fragment.appendChild(block.get(0));
				}

				//this.slider.image1.append($(fragment));
				this.slider.image1.get(0).appendChild(fragment);
			},
			execute: function() {
				var _this = this;

				var blocks = this.slider.image1.find('div.block');

				// Get notified when the last transition has completed
				$(blocks[0]).transitionEnd(function(){
					_this.finished();
				});

				setTimeout(function(){
					blocks.each(function(index, block){
						$(block).css({
							'opacity': '0'
						}).css3({
							'transform': flux.browser.rotateZ((!_this.options.alternate || index%2 ? '' : '-')+'90')
						});
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.warp = function(fluxslider, opts) {
		return new flux.transitions.concentric(fluxslider, $.extend({
			delay: 30,
			alternate: true
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.cube = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			requires3d: true,
			barWidth: 100,
			direction: 'left',
			perspective: 1000,
			setup: function() {
				var width = this.slider.image1.width();
				var height = this.slider.image1.height();

				// Setup the container to allow 3D perspective

				this.slider.image1.css3({
					'perspective': this.options.perspective,
					'perspective-origin': '50% 50%'
				});

				this.cubeContainer = $('<div class="cube"></div>').css({
					width: width+'px',
					height: height+'px',
					position: 'relative'
				}).css3({
					'transition-duration': '800ms',
					'transition-timing-function': 'linear',
					'transition-property': 'all',
					'transform-style': 'preserve-3d'
				});

				var css = {
					height: '100%',
					width: '100%',
					position: 'absolute',
					top: '0px',
					left: '0px'
				};

				var currentFace = $('<div class="face current"></div>').css($.extend(css, {
					background: this.slider.image1.css('background-image')
				})).css3({
					'backface-visibility': 'hidden'
				});

				this.cubeContainer.append(currentFace);

				var nextFace = $('<div class="face next"></div>').css($.extend(css, {
					background: this.slider.image2.css('background-image')
				})).css3({
					'transform' : this.options.transitionStrings.call(this, this.options.direction, 'nextFace'),
					'backface-visibility': 'hidden'
				});

				this.cubeContainer.append(nextFace);

				this.slider.image1.append(this.cubeContainer);
			},
			execute: function() {
				var _this = this;

				var width = this.slider.image1.width();
				var height = this.slider.image1.height();

				this.slider.image2.hide();
				this.cubeContainer.transitionEnd(function(){
					_this.slider.image2.show();

					_this.finished();
				});
				
				setTimeout(function(){
					_this.cubeContainer.css3({
						'transform' : _this.options.transitionStrings.call(_this, _this.options.direction, 'container')
					});
				}, 50);
			},
			transitionStrings: function(direction, elem) {
				var width = this.slider.image1.width();
				var height = this.slider.image1.height();

				// Define the various transforms that are required to perform various cube rotations
				var t = {
					'up' : {
						'nextFace': flux.browser.rotateX(-90) + ' ' + flux.browser.translate(0, height/2, height/2),
						'container': flux.browser.rotateX(90) + ' ' + flux.browser.translate(0, -height/2, height/2)
					},
					'down' : {
						'nextFace': flux.browser.rotateX(90) + ' ' + flux.browser.translate(0, -height/2, height/2),
						'container': flux.browser.rotateX(-90) + ' ' + flux.browser.translate(0, height/2, height/2)
					},
					'left' : {
						'nextFace': flux.browser.rotateY(90) + ' ' + flux.browser.translate(width/2, 0, width/2),
						'container': flux.browser.rotateY(-90) + ' ' + flux.browser.translate(-width/2, 0, width/2)
					},
					'right' : {
						'nextFace': flux.browser.rotateY(-90) + ' ' + flux.browser.translate(-width/2, 0, width/2),
						'container': flux.browser.rotateY(90) + ' ' + flux.browser.translate(width/2, 0, width/2)
					}
				};

				return (t[direction] && t[direction][elem]) ? t[direction][elem] : false;
			}
		}, opts));	
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.tiles3d = function(fluxslider, opts) {
		return new flux.transition_grid(fluxslider, $.extend({
			requires3d: true,
			forceSquare: true,
			columns: 5,
			perspective: 600,
			delayBetweenBarsX: 200,
			delayBetweenBarsY: 150,
			renderTile: function(elem, colIndex, rowIndex, colWidth, rowHeight, leftOffset, topOffset) {
				var tile = $('<div></div>').css({
					width: colWidth+'px',
					height: rowHeight+'px',
					position: 'absolute',
					top: '0px',
					left: '0px',
					//'z-index': 200, // Removed to make compatible with FF10 (Chrome bug seems to have been fixed)

					'background-image': this.slider.image1.css('background-image'),
					'background-position': '-'+leftOffset+'px -'+topOffset+'px',
					'background-repeat': 'no-repeat',
					'-moz-transform': 'translateZ(1px)'
				}).css3({
					'backface-visibility': 'hidden'
				});

				var tile2 = $(tile.get(0).cloneNode(false)).css({
					'background-image': this.slider.image2.css('background-image')
					//'z-index': 190 // Removed to make compatible with FF10 (Chrome bug seems to have been fixed)
				}).css3({
					'transform': flux.browser.rotateY(180),
					'backface-visibility': 'hidden'
				});

				$(elem).css({
					'z-index': (colIndex > this.options.columns/2 ? 500-colIndex : 500) + (rowIndex > this.options.rows/2 ? 500-rowIndex : 500) // Fix for Chrome to ensure that the z-index layering is correct!
				}).css3({
					'transition-duration': '800ms',
					'transition-timing-function': 'ease-out',
					'transition-property': 'all',
					'transition-delay': (colIndex*this.options.delayBetweenBarsX+rowIndex*this.options.delayBetweenBarsY)+'ms',
					'transform-style': 'preserve-3d'
				}).append(tile).append(tile2);
			},
			execute: function() {
				this.slider.image1.css3({
					'perspective': this.options.perspective,
					'perspective-origin': '50% 50%'
				});
				
				var _this = this;

				var tiles = this.slider.image1.find('div.tile');

				this.slider.image2.hide();

				// Get notified when the last transition has completed
				tiles.last().transitionEnd(function(event){
					_this.slider.image2.show();

					_this.finished();
				});
				
				setTimeout(function(){
					tiles.css3({
						'transform': flux.browser.rotateY(180)
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.turn = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			requires3d: true,
			perspective: 1300,
			direction: 'left',
			setup: function() {				
				var tab = $('<div class="tab"></div>').css({
						width: '50%',
						height: '100%',
						position: 'absolute',
						top: '0px',
						left: this.options.direction == 'left' ? '50%' : '0%',
						'z-index':101
					}).css3({
						'transform-style': 'preserve-3d',
						'transition-duration': '1000ms',
						'transition-timing-function': 'ease-out',
						'transition-property': 'all',
						'transform-origin': this.options.direction == 'left' ? 'left center' : 'right center'
					}),

				front = $('<div></div>').appendTo(tab).css({
						'background-image': this.slider.image1.css('background-image'),
						'background-position': (this.options.direction == 'left' ? '-'+(this.slider.image1.width()/2) : 0)+'px 0',
						width: '100%',
						height: '100%',
						position: 'absolute',
						top: '0',
						left: '0',
						'-moz-transform': 'translateZ(1px)'
					}).css3({
						'backface-visibility': 'hidden'
					}),

				back = $('<div></div>').appendTo(tab).css({
						'background-image': this.slider.image2.css('background-image'),
						'background-position': (this.options.direction == 'left' ? 0 : '-'+(this.slider.image1.width()/2))+'px 0',
						width: '100%',
						height: '100%',
						position: 'absolute',
						top: '0',
						left: '0'
					}).css3({
						transform: flux.browser.rotateY(180),
						'backface-visibility': 'hidden'
					}),

				current = $('<div></div>').css({
					position: 'absolute',
					top: '0',
					left: this.options.direction == 'left' ? '0' : '50%',
					width: '50%',
					height: '100%',
					'background-image': this.slider.image1.css('background-image'),
					'background-position': (this.options.direction == 'left' ? 0 : '-'+(this.slider.image1.width()/2))+'px 0',
					'z-index':100
				}),

				overlay = $('<div class="overlay"></div>').css({
					position: 'absolute',
					top: '0',
					left: this.options.direction == 'left' ? '50%' : '0',
					width: '50%',
					height: '100%',
					background: '#000',
					opacity: 1
				}).css3({
					'transition-duration': '800ms',
					'transition-timing-function': 'linear',
					'transition-property': 'opacity'
				}),

				container = $('<div></div>').css3({
					width: '100%',
					height: '100%'
				}).css3({
					'perspective': this.options.perspective,
					'perspective-origin': '50% 50%'
				}).append(tab).append(current).append(overlay);

				this.slider.image1.append(container);
			},
			execute: function() {
				var _this = this;

				this.slider.image1.find('div.tab').first().transitionEnd(function(){
					_this.finished();
				});
				
				setTimeout(function(){
					_this.slider.image1.find('div.tab').css3({
						// 179 not 180 so that the tab rotates the correct way in Firefox
						transform: flux.browser.rotateY(_this.options.direction == 'left' ? -179 : 179)
					});
					_this.slider.image1.find('div.overlay').css({
						opacity: 0
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.slide = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			direction: 'left',
			setup: function() {
				var width = this.slider.image1.width(),
					height = this.slider.image1.height(),

				currentImage = $('<div class="current"></div>').css({
					height: height+'px',
					width: width+'px',
					position: 'absolute',
					top: '0px',
					left: '0px',
					background: this.slider[this.options.direction == 'left' ? 'image1' : 'image2'].css('background-image')	
				}).css3({
					'backface-visibility': 'hidden'
				}),

				nextImage = $('<div class="next"></div>').css({
					height: height+'px',
					width: width+'px',
					position: 'absolute',
					top: '0px',
					left: width+'px',
					background: this.slider[this.options.direction == 'left' ? 'image2' : 'image1'].css('background-image')
				}).css3({
					'backface-visibility': 'hidden'
				});

				this.slideContainer = $('<div class="slide"></div>').css({
					width: (2*width)+'px',
					height: height+'px',
					position: 'relative',
					left: this.options.direction == 'left' ? '0px' : -width+'px',
					'z-index': 101
				}).css3({
					'transition-duration': '600ms',
					'transition-timing-function': 'ease-in',
					'transition-property': 'all'
				});

				this.slideContainer.append(currentImage).append(nextImage);

				this.slider.image1.append(this.slideContainer);
			},
			execute: function() {
				var _this = this,
					delta = this.slider.image1.width();

				if(this.options.direction == 'left')
					delta = -delta;

				this.slideContainer.transitionEnd(function(){
					_this.finished();
				});
				
				setTimeout(function(){
					_this.slideContainer.css3({
						'transform' : flux.browser.translate(delta)
					});
				}, 50);
			}
		}, opts));	
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.swipe = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			setup: function() {
				var img = $('<div></div>').css({
					width: '100%',
					height: '100%',
					'background-image': this.slider.image1.css('background-image')
				}).css3({
					'transition-duration': '1600ms',
					'transition-timing-function': 'ease-in',
					'transition-property': 'all',
					'mask-image': '-webkit-linear-gradient(left, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 48%, rgba(0,0,0,1) 52%, rgba(0,0,0,1) 100%)',
					'mask-position': '70%',
					'mask-size': '400%'
				});
				
				this.slider.image1.append(img);
			},
			execute: function() {
				//return;
				var _this = this,
					img = this.slider.image1.find('div');

				// Get notified when the last transition has completed
				$(img).transitionEnd(function(){
					_this.finished();
				});

				setTimeout(function(){
					$(img).css3({
						'mask-position': '30%'
					});
				}, 50);
			},
			compatibilityCheck: function() {
				return flux.browser.supportsCSSProperty('MaskImage');
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

(function($) {
	flux.transitions.dissolve = function(fluxslider, opts) {
		return new flux.transition(fluxslider, $.extend({
			setup: function() {
				var img = $('<div class="image"></div>').css({
					width: '100%',
					height: '100%',
					'background-image': this.slider.image1.css('background-image')	
				}).css3({
					'transition-duration': '600ms',
					'transition-timing-function': 'ease-in',
					'transition-property': 'opacity'
				});
				
				this.slider.image1.append(img);
			},
			execute: function() {
				var _this = this,
					img = this.slider.image1.find('div.image');

				// Get notified when the last transition has completed
				$(img).transitionEnd(function(){
					_this.finished();
				});

				setTimeout(function(){
					$(img).css({
						'opacity': '0.0'
					});
				}, 50);
			}
		}, opts));
	};
})(window.jQuery || window.Zepto);

