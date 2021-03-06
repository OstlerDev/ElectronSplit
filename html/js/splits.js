var ipc = require('electron').ipcRenderer;

function Actions()
{
	Actions.instance = this;
	this.updates = [];
	this.interval_id = 0;
	this.key_down = false;
	this.table_pos = null;
	this.split_scroll_status = 0;
}

// Singleton implementation
Actions.instance = null;
Actions.get_manager = function()
{
	return Actions.instance;
}

// Binders
Actions.bind_element_action = function(el)
{
	var callback = el.dataset.action;
	if(this[callback])
		el.addEventListener('click', this[callback].bind(this, el));
}

Actions.bind_element_page = function(el)
{
	var destination = el.dataset.page;
	el.addEventListener('click', this.load_page.bind(this, destination));
}

// Sets events and triggers on buttons
Actions.prototype.init = function()
{
	$("[data-action]").each(Actions.bind_element_action, this);
	$("[data-page]").each(Actions.bind_element_page, this);
	
	$(document).on("keydown", this.handle_keydown.bind(this));
	$(document).on("keyup", this.handle_keyup.bind(this));
	
	this.table_pos = q("#timer-splits-container").getBoundingClientRect();
    var drag_handle_evt = (function(event)
    {
    	var y = typeof(event.y) == "undefined" ? event.clientY : event.y;
    	
        var height = Math.max(this.table_pos.height, y - (this.table_pos.top + document.body.scrollTop));
        $("#timer-splits-container").css("height", height + "px" );
        
        this.save_handle_position(height);
    }).bind(this);
    
    // Split size handle
    $("#timer-split-handle").on("mousedown",(function(e)
    {
        $(document).on("mousemove", drag_handle_evt);
        e.preventDefault();
    }).bind(this));
    
    $(document).on("mouseup", (function()
    {
        $(document).off("mousemove", drag_handle_evt);
    }).bind(this));
	
	$("#timer-split-handle").on("dblclick",(function(ev)
	{
		var auto_height = q("#timer-splits").clientHeight;
		$("#timer-splits-container").css("height", auto_height + "px");
		this.save_handle_position(auto_height);
	}).bind(this));
	
	//Initializing split zone height
	this.load_handle_position();
	
	//Initializing scroll
	var wheel_event = "onwheel" in document.createElement("div") ? "wheel" :  // Modern browsers support "wheel"
 						document.onmousewheel !== undefined ? "mousewheel" :  // Webkit and IE support at least "mousewheel"
    														"DOMMouseScroll"; // let's assume that remaining browsers are older Firefox
	
	$("#timer-splits-container").on(wheel_event, this.on_scroll_splits.bind(this));
	
	//Initializing timer list if it isn't already done
	if(typeof localStorage.timer_names == "undefined" || typeof JSON.parse(localStorage.timer_names).pop == "undefined")
		localStorage.timer_names = "[]";
	
	//this.refresh_timer_list();
}

Actions.prototype.on_scroll_splits = function(ev)
{
	var top = parseInt($("#timer-splits").css('top')) || 0;
	
	var current_split_height = $("#timer-splits tr")[this.split_scroll_status].clientHeight;
	
	if(ev.deltaY < 0 && this.split_scroll_status > 0)
		this.split_scroll_status--;
	else if(ev.deltaY > 0 && this.split_scroll_status < $("#timer-splits tr").length - 1)
		this.split_scroll_status++;
	
	$("#timer-splits").css('top', "-" + $("#timer-splits tr")[this.split_scroll_status].offsetTop + 'px');
	
	if(this.split_scroll_status == 0)
		$("#timer-splits").css('top', "0px");
	
	ev.preventDefault();
}

Actions.prototype.save_handle_position = function(new_height)
{
	if(typeof localStorage != "undefined")
		localStorage.handle_position = new_height;
}

Actions.prototype.load_handle_position = function()
{
	if(typeof localStorage != "undefined")
	{
		if(localStorage.handle_position)
			$("#timer-splits-container").css("height", localStorage.handle_position + "px" );
	}
}

// Allows a child object to register for periodic timer updates
Actions.prototype.register_updates = function(object)
{
	if(this.updates.indexOf(object) != -1)
		return false;
	
	this.updates.push(object);

	if(this.updates.length == 1)
		this.interval_id = setInterval(this.update.bind(this), 50);

	return true;
}

Actions.prototype.unregister_updates = function(object)
{
	var index = this.updates.indexOf(object);

	if(index == -1)
		return false;

	this.updates.splice(index, 1);

	if(this.updates.length == 0)
		clearInterval(this.interval_id);

	return true;
}

Actions.prototype.update = function(set_split_time)
{
	set_split_time = typeof set_split_time != "undefined" ? set_split_time : false;
	
	for(var update in this.updates)
		this.updates[update].update();
	
	//Update the gui here
	if(window.current_run)
	{
		var rel_split = null;
		if(window.current_timer.splits[window.current_run.current_split].pb_split)
			rel_split = window.current_run.elapsed - window.current_timer.splits[window.current_run.current_split].pb_split;
		
		$("#global-time").html(window.current_run.get_time(true, 1));
	
		if(rel_split && (rel_split > 0 || set_split_time))
		{
			var rel_human = msec_to_time(rel_split, 1);
			var rel_str = rel_split > 0 ? "+" : "-";
			
			if(rel_human.hr > 0)
				rel_str += rel_human.hr + ":" + (rel_human.mn < 10 ? "0" : "");
			if(rel_human.mn > 0)
				rel_str += rel_human.mn + ":" + (rel_human.sec < 10 ? "0" : "") + rel_human.sec;
			else
				rel_str += rel_human.sec + "." + "<small>" + rel_human.ms + "</small>";
			
			var el = $($("#timer-splits tr")[window.current_run.current_split].querySelector(".time"));
			
			el.html(rel_str);
		}
		
		if(set_split_time)
		{
			var el = $($("#timer-splits tr")[window.current_run.current_split].querySelector(".time"));
			$($("#timer-splits tr")[window.current_run.current_split].querySelector(".ref")).html(msec_to_string(window.current_run.elapsed, true, 0));
			
			var difference = window.current_run.split_times[window.current_run.current_split] - window.current_timer.splits[window.current_run.current_split].pb_duration;
			
			if(window.current_run.current_split > 0)
				difference -= window.current_run.split_times[window.current_run.current_split - 1];
			
			
			var split_time = window.current_run.split_times[window.current_run.current_split];
			if(window.current_run.current_split > 0)
				split_time -= window.current_run.split_times[window.current_run.current_split - 1];
			
			var classes = "";
			
			var classes = "time";
			if(rel_split > 0)
				classes += " late";
			else if(rel_split < 0)
				classes += " ahead";
			
			// Check if the split is gold then set the css class to gold
			if(window.current_timer.splits[window.current_run.current_split].split_best == null || split_time < window.current_timer.splits[window.current_run.current_split].split_best)
				classes = "time split-gold";
			// Check if the split is ahead (green)
			else if(split_time < window.current_timer.splits[window.current_run.current_split].pb_duration)
				classes += " split-ahead";
			else // the split is late (red)
				classes += " split-late";
			
			var rel_human = msec_to_time(difference, 1);
			var rel_str = difference > 0 ? "+" : "-";

			if(rel_human.hr > 0)
				rel_str += rel_human.hr + ":" + (rel_human.mn < 10 ? "0" : "");
			if(rel_human.mn > 0)
				rel_str += rel_human.mn + ":" + (rel_human.sec < 10 ? "0" : "") + rel_human.sec;
			else
				rel_str += rel_human.sec + "." + "<small>" + rel_human.ms + "</small>";
			
			el[0].className = classes;
			q("#previous-segment").className = classes;
			$("#previous-segment").html(rel_str);
		}
	}
}

Actions.prototype.update_sob = function()
{
	var sum_of_bests = 0;
	
	console.log("Refreshing Sum of Bests");
	for(var i in window.current_timer.splits)
	{
		console.log("Split '" + window.current_timer.splits[i].name + "': " + window.current_timer.splits[i].split_best);
		if(sum_of_bests != null && window.current_timer.splits[i].split_best)
			sum_of_bests += window.current_timer.splits[i].split_best;
		else
			sum_of_bests = null;
	}
	
	if(sum_of_bests != null)
		$("#sum-of-bests").html(msec_to_string(sum_of_bests));
	else
		$("#sum-of-bests").html("-");
}

ipc.on("load_timer", function(event, selected_timer){
	var timer = Timer.load(selected_timer);
	console.log(timer);
	Actions.prototype.load_timer(timer);
})

Actions.prototype.load_timer = function(timer)
{
	console.log(timer);
	window.current_timer = timer;
	
	//Setting timer title
	$("#run-title").text(timer.run_name);
	$("#run-count").text(timer.run_count);
	
	//Setting global time
	$("#global-time").html("0:00.<small>0</small>");
	
	$("#timer-splits tr").remove();
	for(var i in timer.splits)
	{
		var new_line = document.createElement("tr");
		var new_cell_name = document.createElement("td");
		var new_cell_time = document.createElement("td");
		var new_cell_ref = document.createElement("td");

		new_cell_name.innerHTML = timer.splits[i].name;
		new_cell_time.classList.add("time");
		new_cell_ref.classList.add("ref");
		
		if(timer.splits[i].pb_split)
		{
			var htime = msec_to_string(timer.splits[i].pb_split, false, 0);
			new_cell_ref.innerHTML = htime;
		}
		else
			new_cell_ref.innerHTML = "-";

		new_line.appendChild(new_cell_name);
		new_line.appendChild(new_cell_time);
		new_line.appendChild(new_cell_ref);
		
		$("#timer-splits").append($(new_line));
		
		//Export button
		//$("#control-button-export").attr('href', 'data:text/plain;charset=utf8,' + encodeURIComponent(timer.to_string()));
		//$("#control-button-export").attr('download', timer.run_name.replace('/', '-') + ".json");
	}
	
	this.update_sob();
}

Actions.prototype.load_empty_timer = function()
{
	$("#run-title").text("-");
	$("#run-count").text("0");
	
	//Setting global time
	$("#global-time").html("0:00.<small>0</small>");
	
	$("#timer-splits tr").remove();
	
	var new_line = document.createElement("tr");
	var new_cell_name = document.createElement("td");
	var new_cell_time = document.createElement("td");
	var new_cell_ref = document.createElement("td");

	new_cell_name.innerHTML = "-";
	new_cell_time.innerHTML = "";
	new_cell_ref.innerHTML = "-";
	new_cell_time.classList.add("time");
	new_cell_ref.classList.add("ref");
	
	new_line.appendChild(new_cell_name);
	new_line.appendChild(new_cell_time);
	new_line.appendChild(new_cell_ref);
	
	$("#timer-splits").append($(new_line));
}

Actions.prototype.handle_keydown = function(ev)
{
	if(!this.key_down)
	{
		switch(ev.keyCode)
		{
			case 32: //Space : start/split
				ev.preventDefault();
				this.timer_start_split();
				break;
			case 40: // Down : skip
			    this.timer_split_skip();
				ev.preventDefault();
			    break;
			case 38: // Up : go back
			    this.timer_split_prev();
				ev.preventDefault();
			    break;
			case 8: // Backspace, stop/reset
			    this.timer_stop_reset();
				ev.preventDefault();
			    break;
		}
	}
}

Actions.prototype.handle_keyup = function(ev)
{
	this.key_down = false;
}

Actions.prototype.timer_start_split = function()
{
	if(window.current_run && window.current_run.started) // A timer run is already started, we split
	{
		if(window.current_timer.timer_type == Timer.Type.RTA)
		{
			$("#timer-splits tr")[window.current_run.current_split].classList.remove("current");
			window.current_run.split();
		}
		else if(window.current_timer.timer_type == Timer.Type.MANUAL)
		{
			var split_time = prompt('Time for split "' + window.current_timer.splits[window.current_run.current_split].name + '"');
			
			if(split_time)
			{			
				$("#timer-splits tr")[window.current_run.current_split].classList.remove("current");
				window.current_run.split_manual(string_to_msec(split_time));
			}
		}
	}
	else // No timer run has been started, we create and start one
	{
		if(window.current_timer)
		{
			this.load_timer(window.current_timer);
			window.current_run = new Run(window.current_timer);
			window.current_run.start();
			
			$("#run-count").text(window.current_timer.run_count);
			
			$("#timer-splits").css('top', "0px");
		}
		
		$("#control-button-skip").removeClass("disabled");
		$("#control-button-back").removeClass("disabled");
	}
	
	if(window.current_run.started)
	{
		$("#timer-splits tr")[window.current_run.current_split].classList.add("current");
	
		//Move splits
		var container_height = q("#timer-splits-container").clientHeight;
		var split_tr = $("#timer-splits tr")[window.current_run.current_split].offsetTop;
		
		var total_height = q("#timer-splits").clientHeight;
		
		if(split_tr > container_height / 2 && total_height > container_height)
		{
			this.split_scroll_status = window.current_run.current_split;
			
			while((split_tr - (container_height / 2)) < $("#timer-splits tr")[this.split_scroll_status].offsetTop)
				this.split_scroll_status--;
			
			$("#timer-splits").css('top', "-" + $("#timer-splits tr")[this.split_scroll_status].offsetTop + "px");
		}
	}
	else
	{
		$("#control-button-play span").text("Start");
		$("#control-button-play i").removeClass("glyphicon-ok").removeClass("glyphicon-stop").addClass("glyphicon-play");
		$("#control-button-reset span").text("Reset");
		$("#control-button-reset i").removeClass("glyphicon-stop").addClass("glyphicon-refresh");
	}
	
	if(window.current_run.current_split + 1 == window.current_timer.splits.length && window.current_timer.timer_type == Timer.Type.RTA)
	{
		$("#control-button-play span").text("Stop");
		$("#control-button-play i").removeClass("glyphicon-play").addClass("glyphicon-stop");
	}
}

Actions.prototype.timer_split_prev = function()
{
	$("#timer-splits tr")[window.current_run.current_split].classList.remove("current");
	window.current_run.prev_split();
	$("#timer-splits tr")[window.current_run.current_split].classList.add("current");
	
	this.update();
	
	//Removing current split
	$($("#timer-splits tr")[window.current_run.current_split].querySelector(".ref")).html(msec_to_string(window.current_timer.splits[window.current_run.current_split].pb_split));
	$($("#timer-splits tr")[window.current_run.current_split].querySelector(".time")).html("");
}

Actions.prototype.timer_split_skip = function()
{
	if(window.current_run && window.current_run.started)
	{
		$("#timer-splits tr")[window.current_run.current_split].classList.remove("current");
		$($("#timer-splits tr")[window.current_run.current_split].querySelector(".time")).html("-");
		$($("#timer-splits tr")[window.current_run.current_split].querySelector(".ref")).html("-");
		window.current_run.next_split();
	
		if(window.current_run.started)
			$("#timer-splits tr")[window.current_run.current_split].classList.add("current");
		else
		{
			$("#control-button-play span").text("Start");
			$("#control-button-play i").removeClass("glyphicon-ok").removeClass("glyphicon-stop").addClass("glyphicon-play");
			$("#control-button-reset span").text("Reset");
			$("#control-button-reset i").removeClass("glyphicon-stop").addClass("glyphicon-refresh");
		}
		
		if(window.current_run.current_split + 1 == window.current_timer.splits.length && window.current_timer.timer_type == Timer.Type.RTA)
		{
			$("#control-button-play span").text("Stop");
			$("#control-button-play i").removeClass("glyphicon-play").addClass("glyphicon-stop");
		}
	}
}

Actions.prototype.timer_stop_reset = function()
{
	if(window.current_run && window.current_run.started)
	{
		this.update();
		window.current_run.stop();
		$("#control-button-reset span").text("Reset");
		$("#control-button-reset i").removeClass("glyphicon-stop").addClass("glyphicon-refresh");
		$("#control-button-play span").text("Restart");
		$("#control-button-play i").removeClass("glyphicon-ok").removeClass("glyphicon-stop").addClass("glyphicon-play");
	}
	else
	{
		window.current_run = null;
		this.load_timer(window.current_timer);
		$("#control-button-play span").text("Start");
		$("#timer-splits").css('top', "0px");
	}
}

Actions.prototype.timer_save_splits = function()
{
	window.current_timer.save_splits(window.current_run);
}

Actions.prototype.timer_close_timer = function()
{
	window.current_run = null;
	window.current_timer = null;
	this.load_empty_timer();
}