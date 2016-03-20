function Run(timer)
{
	this.timer = timer;
	this.elapsed = 0; // Number of milliseconds elapsed
	this.start_time = null; // Instance of Date
	this.split_times = [];
	this.current_split = 0;
	this.started = false;
	this.newPB = false;
	this.newGold = false;
	this.prefs = new Preferences().getPrefs();
}

Run.prototype.start = function()
{
	this.start_time = new Date();
	this.started = true;
	
	this.timer.run_count++;
	this.timer.save();

	// Register to update on global manager
	if(this.timer.timer_type == Timer.Type.RTA)
		Actions.get_manager().register_updates(this);
}

Run.prototype.split = function()
{
	this.split_times[this.current_split] = this.elapsed;
	Actions.get_manager().update(true);
	
	var duration = this.split_times[this.current_split];
	if(this.current_split > 0)
		duration -= this.split_times[this.current_split - 1];
	
	// Check for gold
	if(this.timer.splits[this.current_split].split_best == null || duration < this.timer.splits[this.current_split].split_best){
		this.timer.splits[this.current_split].split_best = duration;

		// Check if we should auto-save the gold split
		if (this.prefs.autoGold){
			this.timer.save();
			Actions.get_manager().update_sob();
		}

		this.newGold = true;
	}
	
	// Increase split counter
	this.current_split++;
	
	// Check if we are done
	if(this.current_split == this.timer.splits.length){
		// Check if we should auto-save PB
		if (this.prefs.autoPB)
			this.timer.save_splits(this);

		// Stop the run
		this.stop(false);
	}
}

Run.prototype.split_manual = function(split_time)
{
	this.split_times[this.current_split] = this.elapsed + split_time;
	this.elapsed += split_time;
	Actions.get_manager().update(true);
	
	//Check for PB
	if(this.timer.splits[this.current_split].split_best == null || split_time < this.timer.splits[this.current_split].split_best)
	{
		this.timer.splits[this.current_split].split_best = split_time;
		this.timer.save();
		Actions.get_manager().update_sob();
	}
	
	this.current_split++;
	
	if(this.current_split == this.timer.splits.length)
		this.stop(false);
}

Run.prototype.prev_split = function()
{
	if(this.current_split > 0)
	{
		this.current_split--;
		
		if(this.timer.timer_type == Timer.Type.MANUAL)
		{
			if(this.current_split == 0)
				this.elapsed = 0;
			else
				this.elapsed = this.split_times[this.current_split - 1];
		}
		
		this.split_times[this.current_split] = null;
	}
}

Run.prototype.next_split = function()
{
	this.split_times[this.current_split] = null;
	this.current_split++;
	
	if(this.current_split == this.timer.splits.length)
		this.stop(false);
}

Run.prototype.stop = function(do_update)
{
	do_update = typeof do_update != "undefined" ? do_update : true;
	
	if(do_update)
		Actions.get_manager().update();
	
	this.started = false;
	Actions.get_manager().unregister_updates(this);
}

Run.prototype.update = function()
{
	var now = new Date();
	this.elapsed = now.getTime() - this.start_time.getTime();
}

Run.prototype.get_time = function(use_markup, res)
{
	use_markup = use_markup || false;
	res = res || 1;

	return msec_to_string(this.elapsed, use_markup, res);
}