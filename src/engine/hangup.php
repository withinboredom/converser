<?php

require_once 'config.php';

event( [
	'type'      => 'call_hangup',
	'caller_id' => $_REQUEST['CallUUID'],
	'From'      => $_REQUEST['From']
] );