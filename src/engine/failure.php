<?php

require_once 'config.php';

event([
	'type' => 'call_failure',
	'from' => cleanPhone($_REQUEST['From']),
	'caller_id' => $_REQUEST['CallUUID']
]);

$r = new Plivo\Response();

$r->addSpeak('Sorry, the service is currently unavailable, please try calling again later');

echo $r->toXML();

die();
