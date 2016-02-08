/*

	Timer.splits[] is the split list. Each split is an object composed like this:
	
	- name: The name of the split
	- pb_duration: The duration of the PB time
	- pb_split: The elapsed time since the beginning of the run
	- split_best: The Golden time.
	
 */

function Timer()
{
	this.timer_name = "";
	this.run_name = "";
	this.run_count = 0;
	this.splits = [];
	this.timer_type = Timer.Type.RTA;
}

Timer.Type = { RTA: 0, MANUAL: 1 };

Timer.prototype.save = function()
{
	if(typeof localStorage != 'undefined')
	{
		localStorage[this.timer_name] = JSON.stringify(this);
		
		var names = JSON.parse(localStorage.timer_names);
		if(typeof names.pop == "undefined")
			names = [];
		
		if(names.indexOf(this.timer_name) == -1)
		{
			names.push(this.timer_name);
			localStorage.timer_names = JSON.stringify(names);
		}
	}
}

Timer.prototype.delete = function()
{
	
	if(typeof localStorage != 'undefined')
	{
		delete localStorage[this.timer_name];
		var names = [];
		
		for(var i in localStorage)
		{
			if(typeof i == "string" && i != "timer_names" && i != "handle_position")
				names.push(i);
		}
		
		localStorage.timer_names = JSON.stringify(names);
	}
}

Timer.prototype.to_string = function()
{
	return JSON.stringify(this);
}

Timer.prototype.save_splits = function(run)
{
	for(var k in this.splits)
	{
		this.splits[k].pb_split = run.split_times[k];
		
		this.splits[k].pb_duration = run.split_times[k];
		if(k > 0)
			this.splits[k].pb_duration -= run.split_times[k - 1];
	}
	
	this.save();
}

Timer.prototype.compute_split_lengths = function()
{
	var previous_elapsed = 0;
	for(var i in this.splits)
	{
		// Fixing PB splits
		if(this.splits[i].pb_split != null)
		{
			this.splits[i].pb_duration = this.splits[i].pb_split - previous_elapsed;
			previous_elapsed = this.splits[i].pb_split;
		}
		else if(this.splits[i].pb_split == null)
			this.splits[i].pb_duration = null;
	}
	 
	// this.save();
}

Timer.load = function(timer_name)
{
	var new_timer = new Timer();

	if(typeof localStorage != 'undefined' && typeof localStorage[timer_name] != 'undefined')
	{
		
		var timer_obj = JSON.parse(localStorage[timer_name]);
		
		for(var k in timer_obj)
			new_timer[k] = timer_obj[k];
		
		new_timer.compute_split_lengths();
		
		// If we haven't got any gold for the split, compute it
		for(var i in new_timer.splits)
		{	
			if(typeof new_timer.splits[i].pb != "undefined")
				delete new_timer.splits[i].pb;
			
			if(!new_timer.splits[i].split_best || (new_timer.splits[i].pb_duration && new_timer.splits[i].split_best > new_timer.splits[i].pb_duration))
				new_timer.splits[i].split_best = new_timer.splits[i].pb_duration;
		}
		
		new_timer.save();
	}
	
	return new_timer;
}

Timer.import_json = function(json)
{
	var new_timer = new Timer();
	var obj = JSON.parse(json);
	
	for(var k in obj)
			new_timer[k] = obj[k];
	
	return new_timer;
}