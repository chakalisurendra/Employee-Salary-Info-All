const {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  GetItemCommand, // Retrieve data fron dynamoDb table
  ScanCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
// Create a DynamoDB client for the specified AWS region
const client = new DynamoDBClient();
//const client = new DynamoDBClient({ region: "ap-south-1" });
// Define regular expressions for validation
//validatins for amount
const amount = /^\d+(\.\d{1,2})?$/;
const PANCardNumber = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Validation function for salaryDetails object
const validation = (salaryDetails) => {
  //amount validation the fields
  if (
    !amount.test(salaryDetails.BasicMonthly) ||
    !amount.test(salaryDetails.DAMonthly) ||
    !amount.test(salaryDetails.SpecialAllowanceMonthly) ||
    !amount.test(salaryDetails.PFSharedMonthly) ||
    !amount.test(salaryDetails.ESIShareMonthly) ||
    !amount.test(salaryDetails.DeductionsMonthly) ||
    !amount.test(salaryDetails.NetPayMonthly) ||
    !amount.test(salaryDetails.BasicYearly) ||
    !amount.test(salaryDetails.DAYearly) ||
    !amount.test(salaryDetails.SpecialAllowanceYearly) ||
    !amount.test(salaryDetails.PFSharedYearly) ||
    !amount.test(salaryDetails.ESIShareYearly) ||
    !amount.test(salaryDetails.DeductionsYearly) ||
    !amount.test(salaryDetails.NetPayYearly)
  ) {
    return "Please enter numbers only for the amount, ensuring exactly two decimal places for Piases!";
  }
  //PANCardNumber
  if (!PANCardNumber.test(salaryDetails.PANCard)) {
    return "Please enter a valid PAN card format, which consists of five letters, followed by four digits, and ending with a single letter, like ABCDE1234F";
  }
  //return null; // Validation passed
};
// Function to create an employee
const salaryHandlerAll = async (event) => {
  let response = { statusCode: 200 };
  const resource = event.resource;
  switch (resource) {
    case `/employee/salary/create`:
      try {
        // Parse the JSON body from the event
        const body = JSON.parse(event.body);
        const salaryDetails = body.salaryDetails;
        console.log(salaryDetails);

        //Check for required fields in the body
        const requiredSalaryDetails = [
          "PANCard",
          "BasicMonthly",
          "DAMonthly",
          "SpecialAllowanceMonthly",
          "PFSharedMonthly",
          "ESIShareMonthly",
          "DeductionsMonthly",
          "NetPayMonthly",
          "BasicYearly",
          "DAYearly",
          "SpecialAllowanceYearly",
          "PFSharedYearly",
          "ESIShareYearly",
          "DeductionsYearly",
          "NetPayYearly",
          //   "IsActive",
          //   "CreatedDateTime",
          //   "UpdatedDateTime",
        ];

        //Iterate salary Details to check mandatory fields
        for (const field of requiredSalaryDetails) {
          if (!body.salaryDetails[field]) {
            response.statusCode = 400;
            throw new Error(`${field} is a mandatory field!`);
          }
        }
        //empId should be given mandatory
        if (!body.empId) {
          response.statusCode = 400;
          throw new Error("empId is a mandatory field!");
        }

        // Perform validation on salaryDetails
        const validationError = validation(salaryDetails);
        if (validationError) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            message: validationError,
          });
          throw new Error(validationError);
        }
        salaryDetails.CreatedDateTime = new Date().toISOString();
        salaryDetails.UpdatedDateTime = new Date().toISOString();
        salaryDetails.IsActive = true;

        // Define parameters for inserting an item into DynamoDB
        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          //add the below line in params to validate post method to restrict duplicate posts
          //ConditionExpression: "attribute_not_exists(empId)",
          Item: marshall({
            empId: body.empId,
            salaryDetails: {
              PANCard: salaryDetails.PANCard,
              BasicMonthly: salaryDetails.BasicMonthly,
              DAMonthly: salaryDetails.DAMonthly,
              SpecialAllowanceMonthly: salaryDetails.SpecialAllowanceMonthly,
              PFSharedMonthly: salaryDetails.PFSharedMonthly,
              ESIShareMonthly: salaryDetails.ESIShareMonthly,
              DeductionsMonthly: salaryDetails.DeductionsMonthly,
              NetPayMonthly: salaryDetails.NetPayMonthly,
              BasicYearly: salaryDetails.BasicYearly,
              DAYearly: salaryDetails.DAYearly,
              SpecialAllowanceYearly: salaryDetails.SpecialAllowanceYearly,
              PFSharedYearly: salaryDetails.PFSharedYearly,
              ESIShareYearly: salaryDetails.ESIShareYearly,
              DeductionsYearly: salaryDetails.DeductionsYearly,
              NetPayYearly: salaryDetails.NetPayYearly,
              IsActive: salaryDetails.IsActive,
              CreatedDateTime: salaryDetails.CreatedDateTime,
              UpdatedDateTime: salaryDetails.UpdatedDateTime,
            },
          }),
        };
        // Insert the item into DynamoDB
        await client.send(new PutItemCommand(params));
        response.body = JSON.stringify({
          message: "Successfully created salaryDetails!",
        });
      } catch (e) {
        // To through the exception if anything failing while creating salaryDetails
        console.error(e);
        console.error(e);
        response.body = JSON.stringify({
          message: "Failed to update salaryDetails.",
          errorMsg: e.message,
          errorStack: e.stack,
        });
      }
      break;
    // Function to update an employee
    case `/employee/salary/update/{empId}`:
      try {
        const body = JSON.parse(event.body);
        const empId = event.pathParameters ? event.pathParameters.empId : null;

        if (!empId) {
          throw new Error("empId not present");
        }

        // Check if the empId exists in the database
        const getItemParams = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          Key: marshall({ empId }),
        };

        const { Item } = await client.send(new GetItemCommand(getItemParams));

        if (!Item) {
          response.statusCode = 404; // Employee Id not found
          response.body = JSON.stringify({
            message: `Employee with empId ${empId} not found`,
          });
          return response;
        }

        const objKeys = Object.keys(body);

        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          Key: marshall({ empId }),
          UpdateExpression: `SET ${objKeys
            .map((_, index) => `#key${index} = :value${index}`)
            .join(", ")}`,
          ExpressionAttributeNames: objKeys.reduce(
            (acc, key, index) => ({
              ...acc,
              [`#key${index}`]: key,
            }),
            {}
          ),
          ExpressionAttributeValues: marshall(
            objKeys.reduce(
              (acc, key, index) => ({
                ...acc,
                [`:value${index}`]: body[key],
              }),
              {}
            )
          ),
        };
        const updateResult = await client.send(new UpdateItemCommand(params));
        response.body = JSON.stringify({
          message: "Successfully updated employee.",
          updateResult,
        });
      } catch (e) {
        console.error(e);
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "Failed to update employee.",
          errorMsg: e.message,
          errorStack: e.stack,
        });
      }
      break;
    case `/employee/salary/get/{empId}`:
      try {
        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME, // Getting table name from the servetless.yml and setting to the TableName
          Key: marshall({ empId: event.pathParameters.empId }), // Convert a JavaScript object into a DynamoDB record.
        };
        //await response from db when sent getItem command with params
        //containing tablename, key and only display empId and bank details
        const { Item } = await client.send(new GetItemCommand(params)); //An asynchronous call to DynamoDB to retrieve an item
        console.log({ Item });
        if (!Item) {
          // If there is no employee bank details found
          response.statusCode = 404; // Setting the status code to 404
          response.body = JSON.stringify({
            message: "Employee bank details not found.",
          }); // Setting error message
        } else {
          // If employee bank details found in the dynamoDB set to data
          response.body = JSON.stringify({
            message: "Successfully retrieved Employee bank details.",
            data: unmarshall(Item), // A DynamoDB record into a JavaScript object and setting to the data
          });
        }
      } catch (e) {
        // If any errors will occurred
        console.error(e);
        response.body = JSON.stringify({
          statusCode: e.statusCode, // Set server side status code
          message: "Failed to retrieved employee bank details.",
          errorMsg: e.message, // Set error message
        });
      }
      break;
    case `/employee/salary/getAll`:
      break;
    case `/employee/salary/detete/{empId}`:
      break;
  }
  return response;
};
// Export the createEmployee and updateEmployee functions
module.exports = {
  salaryHandlerAll,
};
