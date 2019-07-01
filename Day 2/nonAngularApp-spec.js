describe("This is my first non angular protractor test", function() {

it("This test will submit a form", function() 
{

//browser.ignoreSynchronization=true
	
	browser.driver.get("https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html");
	browser.driver.findElement(by.name("first_name")).sendKeys("Tabish");
	browser.driver.findElement(by.name("last_name")).sendKeys("Nasar");
	browser.driver.findElement(by.name("maths")).click();
	
 });
	
});