#!/bin/bash

printf "Updating apt-get...";
sudo apt-get update;

printf "\nInstalling vim...";
sudo apt-get install vim -y;

printf "\nInstalling apache2...";
sudo apt-get install apache2 -y;

printf "\nInstalling php5...";
sudo apt-get install php5 -y;

printf "\nInstalling curl...";
sudo apt-get install php5-curl -y;
sudo apt-get install curl -y;

printf "\nInstalling mysql-server...";
sudo debconf-set-selections <<< 'mysql-server-5.5 mysql-server/root_password password root';
sudo debconf-set-selections <<< 'mysql-server-5.5 mysql-server/root_password_again password root';
sudo apt-get install mysql-server -y;

printf "\nInstalling phpMyAdmin...";
echo 'phpmyadmin phpmyadmin/dbconfig-install boolean true' | debconf-set-selections;
echo 'phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2' | debconf-set-selections;

echo 'phpmyadmin phpmyadmin/app-password-confirm password root' | debconf-set-selections;
echo 'phpmyadmin phpmyadmin/mysql/admin-pass password root' | debconf-set-selections;
echo 'phpmyadmin phpmyadmin/password-confirm password root' | debconf-set-selections;
echo 'phpmyadmin phpmyadmin/setup-password password ' | debconf-set-selections;
echo 'phpmyadmin phpmyadmin/database-type select mysql' | debconf-set-selections;
echo 'phpmyadmin phpmyadmin/mysql/app-pass password root' | debconf-set-selections;

echo 'dbconfig-common dbconfig-common/mysql/app-pass password root' | debconf-set-selections;
echo 'dbconfig-common dbconfig-common/mysql/app-pass password' | debconf-set-selections;
echo 'dbconfig-common dbconfig-common/password-confirm password root' | debconf-set-selections;
echo 'dbconfig-common dbconfig-common/app-password-confirm password root' | debconf-set-selections;
echo 'dbconfig-common dbconfig-common/app-password-confirm password root' | debconf-set-selections;
echo 'dbconfig-common dbconfig-common/password-confirm password root' | debconf-set-selections;
sudo apt-get install phpmyadmin -y;

if [ ! -f /home/vagrant/database_made ];
then
	printf "\nCreating database and tables...";
	echo "CREATE DATABASE jestr" | mysql -uroot -proot;
	mysql -uroot -proot jestr < /var/www/vagrant-setup/create-tables.txt;
	touch /home/vagrant/database_made;	
fi

if [ ! -f /var/www/phpmyadmin/index.php ];
then
	printf "\nMaking phpMyAdmin link...";
	sudo ln -s /usr/share/phpmyadmin /var/www/phpmyadmin;
fi

if [ ! -f /var/db_info.txt ];
then
	printf "\nCreating db_info.txt...";
	sudo printf "username: root\npassword: root\ndb_name: jestr" > /var/db_info.txt;
	sudo chmod 400 /var/db_info.txt;
	sudo chown www-data /var/db_info.txt;
fi

printf "\nInstalling sendmail...";
sudo apt-get install sendmail -y;
