import React from 'react';
import logo from '../../assets/img/logo.svg';
import Greetings from '../../containers/Greetings/Greetings';
import './Popup.css';

const Popup = () => {
  const [totals, setTotals] = React.useState([]);
  const handleButtonClick = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // expand product list
          const element = document.querySelector(
            '[data-automation-id="items-toggle-link"]'
          );
          if (element && element.getAttribute('aria-expanded') === 'false') {
            element.click();
          }

          // get products
          let products = [];
          const categoryAccordion = document.querySelectorAll(
            '[data-testid="itemtile-stack"]'
          );
          if (categoryAccordion) {
            const data = Array.from(categoryAccordion).map((item) => ({
              name: item.querySelector('[data-testid="productName"]')
                ?.innerText,
              price: item.querySelector('[data-testid="line-price"]')
                ?.innerText,
            }));
            products = data.filter((item) => item.name);
            console.log('products', products);
          }

          // send request to OpenAi to categorize
          if (products.length > 0) {
            const schema = {
              name: 'categorized_products',
              schema: {
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                  products: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        Category: {
                          type: 'string',
                        },
                        'Item Name': {
                          type: 'string',
                        },
                        'Subtotal ($)': {
                          type: 'number',
                          minimum: 0,
                        },
                      },
                      required: ['Category', 'Item Name', 'Subtotal ($)'],
                    },
                  },
                },
                required: ['products'],
              },
            };
            console.log('Categorizing products:', products);
            fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer API_Key`,
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are a receipt categorizer. Take the list of products and cagegorize them. Return the json with the category, item name, and the subtotal. If it is a type of food, the category is groceries. Categorize all products. If they are not grocery, figure out the next best category. Be detailed with the categories.',
                  },
                  {
                    role: 'user',
                    content:
                      'Categorize the following products: ' +
                      JSON.stringify(products),
                  },
                ],
                model: 'gpt-4o-mini',
                response_format: {
                  type: 'json_schema',
                  json_schema: schema,
                },
              }),
            })
              .then((response) => response.json())
              .then((resp) => {
                const data = JSON.parse(
                  resp.choices[0].message?.content
                ).products;
                const categorizedTotals = data.reduce((acc, product) => {
                  const {
                    Category,
                    'Subtotal ($)': subtotal,
                    'Item Name': itemName,
                  } = product;
                  if (!acc[Category]) {
                    acc[Category] = { total: 0, items: [] };
                  }
                  acc[Category].total += subtotal;
                  acc[Category].items.push(itemName);
                  return acc;
                }, {});

                const subArray = Object.keys(categorizedTotals).map(
                  (category) => ({
                    category,
                    total: categorizedTotals[category].total,
                    items: categorizedTotals[category].items,
                  })
                );

                // multiply non grocery categories by 1.101
                subArray.forEach((item) => {
                  if (item.category !== 'groceries') {
                    item.total *= 1.101;
                  }
                });

                console.log('----------------------');

                subArray.forEach((d) => {
                  console.log(d.category);
                  console.log(d.total.toFixed(2));
                  console.log(d.items);
                  console.log('----------------------');
                });

                return subArray;
              })
              .catch((error) => {
                console.error('Error:', error);
              });
          }
        },
      });
    }
  };
  return (
    <div className="App">
      <button onClick={handleButtonClick}>Click me</button>
      {totals.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Total</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((total, index) => (
              <tr key={index}>
                <td>{total.category}</td>
                <td>{total.total}</td>
                <td>{total.items.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Popup;
